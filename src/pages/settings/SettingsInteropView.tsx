import { useMemo, useState } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { useTaskStore, updateTaskFields } from '../../lib/stores/task-store';
import { useTemplateStore, createTemplate, updateTemplate } from '../../lib/stores/template-store';
import { ensureWorkTypeExistsOrCreate, useWorkTypeStore } from '../../lib/stores/work-type-store';
import { buildAttributedRollup } from '../../lib/attributed-rollup';
import { computeWorkTypeKpis } from '../../lib/kpi';
import { exportKpis, type ExportProfile } from '../../lib/interop/export';
import { parseWorkPackageCsv, type ImportedWorkPackage } from '../../lib/interop/import';
import { generateImportPreview, type ImportPreview } from '../../lib/interop/import-preview';
import { exportWorkTypesCsv } from '../../lib/interop/work-type-export';
import {
  applyWorkTypeImport,
  generateWorkTypeImportPreview,
  parseWorkTypeCsv,
  type WorkTypeImportPreview,
} from '../../lib/interop/work-type-import';
import { getOutlierHandlingMode } from '../../lib/stores/kpi-settings';
import { runMaintenanceScanFromDb, type MaintenanceReport } from '../../lib/archive/maintenance';
import { recomputeArchivedKpisByVersion, type RecomputedArchiveKpiGroup } from '../../lib/archive/recompute';
import { createRecomputeChangeReport, type RecomputeChangeReport } from '../../lib/archive/recompute-report';
import { getAttributionPolicy } from '../../lib/stores/attribution-settings';
import { getFeatureFlag } from '../../lib/flags/feature-flags';
import { isRolloutGateOpen, IMPORT_APPLY_GATE, ARCHIVE_RECOMPUTE_GATE } from '../../lib/flags/rollout-gates';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

interface SettingsInteropViewProps {
  onBack: () => void;
}

function previewItemSignature(item: ImportPreview['items'][number]): string {
  return [
    item.action,
    item.existingId ?? '',
    item.existingType ?? '',
    item.changedFields.join('|'),
  ].join('::');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface WorkPackageImportApplyResult {
  created: number;
  updated: number;
  skipped: number;
}

interface WorkPackageImportApplyDeps {
  ensureWorkTypeExistsOrCreateFn?: (
    title: string,
    workUnit: ImportedWorkPackage['workUnit'],
    buildPhase: ImportedWorkPackage['buildPhase'],
    defaultExpectedProductivity: number,
  ) => Promise<string>;
  updateTemplateFn?: typeof updateTemplate;
  updateTaskFieldsFn?: typeof updateTaskFields;
  createTemplateFn?: typeof createTemplate;
}

export async function applyWorkPackageImportItems(
  items: ImportPreview['items'],
  deps: WorkPackageImportApplyDeps = {},
): Promise<WorkPackageImportApplyResult> {
  const ensureWorkTypeExistsOrCreateFn = deps.ensureWorkTypeExistsOrCreateFn ?? ensureWorkTypeExistsOrCreate;
  const updateTemplateFn = deps.updateTemplateFn ?? updateTemplate;
  const updateTaskFieldsFn = deps.updateTaskFieldsFn ?? updateTaskFields;
  const createTemplateFn = deps.createTemplateFn ?? createTemplate;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const payload = item.item;

    if (item.action === 'skip') {
      skipped += 1;
      continue;
    }

    const resolvedWorkTypeId = payload.workTypeId ?? await ensureWorkTypeExistsOrCreateFn(
      payload.workTypeTitle,
      payload.workUnit,
      payload.buildPhase,
      0,
    );

    if (item.action === 'update' && item.existingId && item.existingType === 'template') {
      await updateTemplateFn(item.existingId, {
        title: payload.title,
        workTypeId: resolvedWorkTypeId,
        workUnit: payload.workUnit,
        buildPhase: payload.buildPhase,
        workQuantity: payload.workQuantity,
        estimatedMinutes: payload.estimatedMinutes,
        defaultWorkers: payload.defaultWorkers,
        targetProductivity: payload.targetProductivity,
      });
      updated += 1;
      continue;
    }

    if (item.action === 'update' && item.existingId && item.existingType === 'task') {
      await updateTaskFieldsFn(item.existingId, {
        title: payload.title,
        workTypeId: resolvedWorkTypeId,
        workUnit: payload.workUnit,
        buildPhase: payload.buildPhase,
        workQuantity: payload.workQuantity,
        estimatedMinutes: payload.estimatedMinutes,
        defaultWorkers: payload.defaultWorkers,
        targetProductivity: payload.targetProductivity,
      });
      updated += 1;
      continue;
    }

    await createTemplateFn({
      title: payload.title,
      workTypeId: resolvedWorkTypeId,
      workUnit: payload.workUnit,
      buildPhase: payload.buildPhase,
      workQuantity: payload.workQuantity,
      estimatedMinutes: payload.estimatedMinutes,
      defaultWorkers: payload.defaultWorkers,
      targetProductivity: payload.targetProductivity,
    });
    created += 1;
  }

  return { created, updated, skipped };
}

export function SettingsInteropView({ onBack }: SettingsInteropViewProps) {
  const { tasks } = useTaskStore();
  const { templates } = useTemplateStore();
  const { workTypes } = useWorkTypeStore();
  const [exportProfile, setExportProfile] = useState<ExportProfile>('ops_summary');
  const [isExporting, setIsExporting] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applySummary, setApplySummary] = useState<string | null>(null);
  const [isExportingWorkTypes, setIsExportingWorkTypes] = useState(false);
  const [workTypeCsvInput, setWorkTypeCsvInput] = useState('');
  const [workTypeParseErrors, setWorkTypeParseErrors] = useState<string[]>([]);
  const [workTypePreview, setWorkTypePreview] = useState<WorkTypeImportPreview | null>(null);
  const [isApplyingWorkTypeImport, setIsApplyingWorkTypeImport] = useState(false);
  const [workTypeExportSummary, setWorkTypeExportSummary] = useState<string | null>(null);
  const [workTypeImportSummary, setWorkTypeImportSummary] = useState<string | null>(null);
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceReport | null>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [archiveGroups, setArchiveGroups] = useState<RecomputedArchiveKpiGroup[] | null>(null);
  const [recomputeReport, setRecomputeReport] = useState<RecomputeChangeReport | null>(null);
  const [isRecomputingArchive, setIsRecomputingArchive] = useState(false);

  const workTypeTitleById = useMemo(
    () => new Map(workTypes.map((wt) => [wt.id, wt.title])),
    [workTypes],
  );
  const staleGuardEnabled = getFeatureFlag('interopStaleImportGuard');
  const archiveToolsEnabled = getFeatureFlag('archiveMaintenanceTools');

  // Rollout gates: flag + quality metric thresholds
  const importApplyGateOpen = isRolloutGateOpen(IMPORT_APPLY_GATE);
  const archiveRecomputeGateOpen = isRolloutGateOpen(ARCHIVE_RECOMPUTE_GATE);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const outlierMode = getOutlierHandlingMode();
      const kpis = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        archiveOnly: true,
        workTypes,
        outlierMode,
      });
      const csv = exportKpis(kpis, exportProfile);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`kpi-${exportProfile}-${stamp}.csv`, csv);
      setApplySummary(`Exported ${kpis.length} KPI rows.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleParse = () => {
    const parsed = parseWorkPackageCsv(csvInput);
    if (!parsed.valid) {
      setPreview(null);
      setParseErrors(parsed.errors.map((e) => `Row ${e.row}: ${e.field} - ${e.message}`));
      return;
    }
    const nextPreview = generateImportPreview(parsed.items, tasks, templates, workTypeTitleById);
    setParseErrors([]);
    setPreview(nextPreview);
  };

  const handleWorkTypeExport = () => {
    setIsExportingWorkTypes(true);
    try {
      const csv = exportWorkTypesCsv(workTypes);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`work-types-${stamp}.csv`, csv);
      setWorkTypeExportSummary(`Exported ${workTypes.length} work type definitions.`);
    } finally {
      setIsExportingWorkTypes(false);
    }
  };

  const handleParseWorkTypeImport = () => {
    const parsed = parseWorkTypeCsv(workTypeCsvInput);
    if (!parsed.valid) {
      setWorkTypePreview(null);
      setWorkTypeParseErrors(parsed.errors.map((error) => `Row ${error.row}: ${error.field} - ${error.message}`));
      return;
    }

    setWorkTypeParseErrors([]);
    setWorkTypeImportSummary(null);
    setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, workTypes));
  };

  const handleApplyWorkTypeImport = async () => {
    if (!workTypePreview) return;
    setIsApplyingWorkTypeImport(true);
    try {
      const result = await applyWorkTypeImport(workTypePreview.items.map((item) => item.item));
      setWorkTypeImportSummary(`Applied import: ${result.created} created, ${result.updated} updated.`);
      setWorkTypePreview(null);
      setWorkTypeCsvInput('');
      setWorkTypeParseErrors([]);
    } finally {
      setIsApplyingWorkTypeImport(false);
    }
  };

  const handleApply = async () => {
    if (!preview || preview.duplicateKeys.length > 0) return;
    setIsApplying(true);
    let conflicts = 0;

    try {
      // Re-validate against current data to catch stale imports since preview.
      const revalidated = generateImportPreview(
        preview.items.map((i) => i.item),
        tasks,
        templates,
        workTypeTitleById,
      );
      const staleItems = preview.items.filter((item, index) => {
        const latest = revalidated.items[index];
        if (!latest) return true;
        return previewItemSignature(item) !== previewItemSignature(latest);
      });

      if (revalidated.duplicateKeys.length > 0 || (staleGuardEnabled && staleItems.length > 0)) {
        setPreview(revalidated);
        conflicts = (staleGuardEnabled ? staleItems.length : 0) + revalidated.duplicateKeys.length;
        setApplySummary(
          `Import conflicts detected: ${staleGuardEnabled ? staleItems.length : 0} stale item(s), ${revalidated.duplicateKeys.length} duplicate key issue(s). Re-review preview before apply.`,
        );
        trackTelemetryEvent('interop_import_conflict');
        return;
      }

      const { created, updated, skipped } = await applyWorkPackageImportItems(revalidated.items);

      setApplySummary(`Applied import: ${created} created, ${updated} updated, ${skipped} skipped, ${conflicts} conflicts.`);
      trackTelemetryEvent('interop_import_apply');
      setPreview(null);
      setCsvInput('');
      setParseErrors([]);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRunMaintenance = async () => {
    setIsRunningMaintenance(true);
    try {
      const report = await runMaintenanceScanFromDb();
      setMaintenanceReport(report);
      trackTelemetryEvent('archive_maintenance_scan');
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  const handleRecomputeArchivedKpis = async () => {
    setIsRecomputingArchive(true);
    try {
      const policy = getAttributionPolicy();
      const outlierMode = getOutlierHandlingMode();
      const result = await recomputeArchivedKpisByVersion({
        policy,
        outlierMode,
      });
      if (archiveGroups) {
        setRecomputeReport(createRecomputeChangeReport(archiveGroups, result.groups));
      } else {
        setRecomputeReport(null);
      }
      setArchiveGroups(result.groups);
      setApplySummary(
        `Recomputed archived KPIs across ${result.groups.length} archive version group(s) and ${result.totalArchivedTasks} archived tasks.`,
      );
      trackTelemetryEvent('archive_kpi_recompute');
    } finally {
      setIsRecomputingArchive(false);
    }
  };

  return (
    <SettingsDetailLayout title="Interop" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export KPI CSV</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
        <p className="settings-view__helper">Export archive-grade KPI profiles for planner interop</p>
        <label className="settings-view__row">
          <span className="settings-view__row-label">Profile</span>
          <select
            className="input"
            value={exportProfile}
            onChange={(e) => setExportProfile(e.target.value as ExportProfile)}
          >
            <option value="ops_summary">Ops Summary</option>
            <option value="estimator_summary">Estimator Summary</option>
            <option value="phase_summary">Phase Summary</option>
          </select>
        </label>
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Work Types</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleWorkTypeExport}
            disabled={isExportingWorkTypes}
          >
            {isExportingWorkTypes ? 'Exporting...' : 'Export'}
          </button>
        </div>
        <p className="settings-view__helper">Export work type definitions as CSV.</p>
        {workTypeExportSummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {workTypeExportSummary}
          </p>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Work Packages</h2>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleParse}>
            Parse + Preview
          </button>
        </div>
        <p className="settings-view__helper">Paste CSV (title, workTypeTitle, workUnit, buildPhase, ...)</p>
        <textarea
          className="input"
          rows={8}
          value={csvInput}
          onChange={(e) => setCsvInput(e.target.value)}
          placeholder="title,workTypeTitle,workUnit,buildPhase,workQuantity,estimatedMinutes,defaultWorkers,targetProductivity"
        />

        {parseErrors.length > 0 && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            {parseErrors.slice(0, 8).map((error) => (
              <div key={error} className="settings-view__row-detail">{error}</div>
            ))}
          </div>
        )}

        {preview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              {preview.summary.create} create · {preview.summary.update} update · {preview.summary.skip} skip
            </div>
            {preview.duplicateKeys.length > 0 && (
              <div className="settings-view__row-detail">
                Duplicate mapping keys: {preview.duplicateKeys.length}. Resolve before apply.
              </div>
            )}
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isApplying || preview.duplicateKeys.length > 0 || !importApplyGateOpen}
              onClick={handleApply}
            >
              {isApplying ? 'Applying...' : !importApplyGateOpen ? 'Blocked by quality gate' : 'Apply Import'}
            </button>
          </div>
        )}

        {applySummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {applySummary}
          </p>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Work Types</h2>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleParseWorkTypeImport}>
            Parse + Preview
          </button>
        </div>
        <p className="settings-view__helper">Paste CSV (title, workUnit, buildPhase, expectedProductivity)</p>
        <textarea
          className="input"
          rows={8}
          value={workTypeCsvInput}
          onChange={(event) => setWorkTypeCsvInput(event.target.value)}
          placeholder="title,workUnit,buildPhase,expectedProductivity"
        />

        {workTypeParseErrors.length > 0 && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            {workTypeParseErrors.slice(0, 8).map((error) => (
              <div key={error} className="settings-view__row-detail">{error}</div>
            ))}
          </div>
        )}

        {workTypePreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              {workTypePreview.summary.create} create · {workTypePreview.summary.update} update
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isApplyingWorkTypeImport}
              onClick={() => {
                void handleApplyWorkTypeImport();
              }}
            >
              {isApplyingWorkTypeImport ? 'Applying...' : 'Apply Import'}
            </button>
          </div>
        )}

        {workTypeImportSummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {workTypeImportSummary}
          </p>
        )}
      </div>

      {archiveToolsEnabled && (
        <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Archive Maintenance</h2>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              void handleRunMaintenance();
            }}
            disabled={isRunningMaintenance}
          >
            {isRunningMaintenance ? 'Running...' : 'Run Integrity Scan'}
          </button>
        </div>
        <p className="settings-view__helper">Scan archived records and pending archival tasks for integrity issues.</p>

        {maintenanceReport && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              Archived scanned: {maintenanceReport.archivedCount} · Pending: {maintenanceReport.pendingCount}
            </div>
            <div className="settings-view__row-detail">
              Archived issues: {maintenanceReport.archivedIssues.length} · Archive-ready: {maintenanceReport.archiveCandidates.length} · Blocked: {maintenanceReport.blockedFromArchival.length}
            </div>
            {maintenanceReport.archivedIssues.slice(0, 3).map((issue) => (
              <div key={`${issue.taskId}-${issue.issue.type}`} className="settings-view__row-detail">
                {issue.taskId}: {issue.description}
              </div>
            ))}
          </div>
        )}

        <div className="settings-view__card-header" style={{ marginTop: 12 }}>
          <h3 className="settings-view__sub-header" style={{ fontSize: '1rem' }}>Archived KPI Recompute</h3>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              void handleRecomputeArchivedKpis();
            }}
            disabled={isRecomputingArchive || !archiveRecomputeGateOpen}
          >
            {isRecomputingArchive ? 'Recomputing...' : !archiveRecomputeGateOpen ? 'Blocked by quality gate' : 'Recompute KPIs'}
          </button>
        </div>
        <p className="settings-view__helper">Recompute archive-grade KPIs by archive engine version and report what changed.</p>

        {archiveGroups && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            {archiveGroups.map((group) => (
              <div key={group.archiveVersion} className="settings-view__row-detail">
                {group.archiveVersion}: {group.taskCount} tasks · {group.kpis.length} KPI rows
              </div>
            ))}
          </div>
        )}
        {recomputeReport && (
          <div className="settings-view__list" style={{ marginTop: 8 }}>
            <div className="settings-view__row-detail">
              Changes: {recomputeReport.totalChanges} total ({recomputeReport.totalAdded} added · {recomputeReport.totalChanged} changed · {recomputeReport.totalRemoved} removed)
            </div>
            {recomputeReport.changes.slice(0, 5).map((change) => (
              <div key={`${change.archiveVersion}-${change.key}-${change.status}`} className="settings-view__row-detail">
                {change.archiveVersion} · {change.key} · {change.status}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </SettingsDetailLayout>
  );
}

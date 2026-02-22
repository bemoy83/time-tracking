import { useMemo, useState } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { useTaskStore, updateTaskFields } from '../../lib/stores/task-store';
import { useTemplateStore, createTemplate, updateTemplate } from '../../lib/stores/template-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { buildAttributedRollup } from '../../lib/attributed-rollup';
import { computeWorkTypeKpis } from '../../lib/kpi';
import { exportKpis, type ExportProfile } from '../../lib/interop/export';
import { parseWorkPackageCsv } from '../../lib/interop/import';
import { generateImportPreview, type ImportPreview } from '../../lib/interop/import-preview';

interface SettingsInteropViewProps {
  onBack: () => void;
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

  const workTypeTitleById = useMemo(
    () => new Map(workTypes.map((wt) => [wt.id, wt.title])),
    [workTypes],
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const kpis = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        archiveOnly: true,
        workTypes,
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

  const handleApply = async () => {
    if (!preview || preview.duplicateKeys.length > 0) return;
    setIsApplying(true);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      for (const item of preview.items) {
        const payload = item.item;
        const workCategory = payload.legacyWorkCategory;

        if (item.action === 'skip') {
          skipped += 1;
          continue;
        }

        if (item.action === 'update' && item.existingId && item.existingType === 'template') {
          await updateTemplate(item.existingId, {
            title: payload.title,
            workTypeId: payload.workTypeId,
            workCategory,
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
          await updateTaskFields(item.existingId, {
            title: payload.title,
            workTypeId: payload.workTypeId,
            workCategory,
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

        await createTemplate({
          title: payload.title,
          workTypeId: payload.workTypeId,
          workCategory,
          workUnit: payload.workUnit,
          buildPhase: payload.buildPhase,
          workQuantity: payload.workQuantity,
          estimatedMinutes: payload.estimatedMinutes,
          defaultWorkers: payload.defaultWorkers,
          targetProductivity: payload.targetProductivity,
        });
        created += 1;
      }

      setApplySummary(`Applied import: ${created} created, ${updated} updated, ${skipped} skipped.`);
      setPreview(null);
      setCsvInput('');
      setParseErrors([]);
    } finally {
      setIsApplying(false);
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
              disabled={isApplying || preview.duplicateKeys.length > 0}
              onClick={handleApply}
            >
              {isApplying ? 'Applying...' : 'Apply Import'}
            </button>
          </div>
        )}

        {applySummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {applySummary}
          </p>
        )}
      </div>
    </SettingsDetailLayout>
  );
}

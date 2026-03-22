import { useRef, useState, type ChangeEvent } from 'react';
import { AlertDialog } from '../../components/AlertDialog';
import { ExportIcon, ImportIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { WorkUnitImportPreviewPanel } from '../../components/WorkUnitImportPreviewPanel';
import type {
  ExecutionReturnImportPreview,
  ExecutionReturnMergeSummary,
  FullBackupEntityCounts,
  FullBackupImportPreview,
  PlanPackageImportPreview,
} from '../../lib/interop/data-transfer/contracts';
import {
  applyExecutionReturnImport,
  formatExecutionReturnMergeSummary,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from '../../lib/interop/data-transfer/execution-return-import';
import {
  applyFullBackupImport,
  exportFullBackupToFile,
  parseFullBackupJson,
  previewFullBackupImport,
} from '../../lib/interop/data-transfer/full-backup';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../lib/interop/data-transfer/handoff-copy';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import './settings-styles';

interface SettingsDataTransferViewProps {
  onBack: () => void;
}

function sumBackupCounts(counts: FullBackupEntityCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function formatBackupSummary(counts: FullBackupEntityCounts): string {
  return [
    `${counts.tasks} tasks`,
    `${counts.timeEntries} time entries`,
    `${counts.plans} plans`,
    `${counts.workTypes} work types`,
    `${counts.tags} tags`,
    `${counts.taskNotes + counts.templateNotes} notes`,
  ].join(' · ');
}

export function SettingsDataTransferView({ onBack }: SettingsDataTransferViewProps) {
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const executionFileInputRef = useRef<HTMLInputElement>(null);
  const fullBackupFileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingPlanPreview, setIsLoadingPlanPreview] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanPackageImportPreview | null>(null);
  const [planImportMessage, setPlanImportMessage] = useState<string | null>(null);
  const [isApplyingPlanImport, setIsApplyingPlanImport] = useState(false);

  const [isLoadingExecutionPreview, setIsLoadingExecutionPreview] = useState(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionReturnImportPreview | null>(null);
  const [executionImportMessage, setExecutionImportMessage] = useState<string | null>(null);
  const [isApplyingExecutionImport, setIsApplyingExecutionImport] = useState(false);
  const [executionMergeSummary, setExecutionMergeSummary] = useState<ExecutionReturnMergeSummary | null>(null);

  const [isExportingFullBackup, setIsExportingFullBackup] = useState(false);
  const [isLoadingFullBackupPreview, setIsLoadingFullBackupPreview] = useState(false);
  const [fullBackupPreview, setFullBackupPreview] = useState<FullBackupImportPreview | null>(null);
  const [fullBackupMessage, setFullBackupMessage] = useState<string | null>(null);
  const [isApplyingFullBackupImport, setIsApplyingFullBackupImport] = useState(false);
  const [isFullBackupConfirmOpen, setIsFullBackupConfirmOpen] = useState(false);

  const {
    preview: planWorkUnitPreview,
    applyImportedLabels: applyPlanUnitLabels,
    setApplyImportedLabels: setApplyPlanUnitLabels,
  } = useWorkUnitImportPreview(
    planPreview?.envelope.payload.workUnitDefinitions?.map((definition) => ({
      id: definition.id,
      label: definition.label,
    })) ?? null,
    workUnitDefinitions,
  );
  const {
    preview: executionWorkUnitPreview,
    applyImportedLabels: applyExecutionUnitLabels,
    setApplyImportedLabels: setApplyExecutionUnitLabels,
  } = useWorkUnitImportPreview(
    executionPreview?.envelope.payload.workUnitDefinitions?.map((definition) => ({
      id: definition.id,
      label: definition.label,
    })) ?? null,
    workUnitDefinitions,
  );

  const handlePlanFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setPlanImportMessage(null);
    setPlanPreview(null);
    setIsLoadingPlanPreview(true);

    try {
      const text = await file.text();
      const parsed = parsePlanPackageJson(text);
      if (!parsed.ok) {
        setPlanImportMessage(parsed.error);
        return;
      }
      const nextPreview = await previewPlanPackageImport(parsed.envelope);
      setPlanPreview(nextPreview);
      trackTelemetryEvent('interop_plan_package_preview');
    } finally {
      setIsLoadingPlanPreview(false);
    }
  };

  const handleApplyPlanImport = async (resolution: 'replace' | 'skip' = 'replace') => {
    if (!planPreview) return;
    setIsApplyingPlanImport(true);
    try {
      const result = await applyPlanPackageImport(planPreview, resolution, {
        applyLabelToExistingWorkUnits: applyPlanUnitLabels,
      });
      let msg = result.reason;
      if (result.mergeSummary) {
        const { newCount, updatedCount, unchangedCount, removedCount } = result.mergeSummary;
        msg += ` Merged: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${removedCount} removed.`;
      }
      setPlanImportMessage(msg);
      if (result.applied) {
        setPlanPreview(null);
        trackTelemetryEvent(result.merged ? 'interop_plan_package_merge' : 'interop_plan_package_import');
      } else if (resolution === 'skip') {
        trackTelemetryEvent('interop_plan_package_skip');
      } else {
        trackTelemetryEvent('interop_plan_package_conflict');
      }
    } finally {
      setIsApplyingPlanImport(false);
    }
  };

  const handleExecutionFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setExecutionImportMessage(null);
    setExecutionPreview(null);
    setExecutionMergeSummary(null);
    setIsLoadingExecutionPreview(true);

    try {
      const text = await file.text();
      const parsed = parseExecutionReturnJson(text);
      if (!parsed.ok) {
        setExecutionImportMessage(parsed.error);
        trackTelemetryEvent('interop_execution_return_preview_failed');
        return;
      }
      const nextPreview = await previewExecutionReturnImport(parsed.envelope);
      setExecutionPreview(nextPreview);
      trackTelemetryEvent('interop_execution_return_preview');
    } finally {
      setIsLoadingExecutionPreview(false);
    }
  };

  const handleApplyExecutionImport = async () => {
    if (!executionPreview) return;
    setIsApplyingExecutionImport(true);

    try {
      const result = await applyExecutionReturnImport(executionPreview, {
        applyLabelToExistingWorkUnits: applyExecutionUnitLabels,
      });
      setExecutionImportMessage(result.reason);
      setExecutionMergeSummary(result.mergeSummary);
      setExecutionPreview(null);
      trackTelemetryEvent('interop_execution_return_import');
    } catch {
      setExecutionImportMessage('Failed to import execution return.');
      setExecutionMergeSummary(null);
      trackTelemetryEvent('interop_execution_return_import_failed');
    } finally {
      setIsApplyingExecutionImport(false);
    }
  };

  const handleExportFullBackup = async () => {
    setIsExportingFullBackup(true);
    setFullBackupMessage(null);
    try {
      await exportFullBackupToFile();
      setFullBackupMessage('Full backup exported.');
      trackTelemetryEvent('interop_full_backup_export');
    } catch {
      setFullBackupMessage('Failed to export full backup.');
    } finally {
      setIsExportingFullBackup(false);
    }
  };

  const handleFullBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setFullBackupMessage(null);
    setFullBackupPreview(null);
    setIsFullBackupConfirmOpen(false);
    setIsLoadingFullBackupPreview(true);

    try {
      const text = await file.text();
      const parsed = parseFullBackupJson(text);
      if (!parsed.ok) {
        setFullBackupMessage(parsed.error);
        return;
      }
      const nextPreview = await previewFullBackupImport(parsed.envelope);
      setFullBackupPreview(nextPreview);
    } finally {
      setIsLoadingFullBackupPreview(false);
    }
  };

  const handleApplyFullBackupImport = async () => {
    if (!fullBackupPreview) return;
    setIsApplyingFullBackupImport(true);
    try {
      const result = await applyFullBackupImport(fullBackupPreview);
      setFullBackupMessage(result.reason);
      setIsFullBackupConfirmOpen(false);
      setFullBackupPreview(null);
      trackTelemetryEvent('interop_full_backup_import');
      window.location.reload();
    } catch (error) {
      setFullBackupMessage(error instanceof Error ? error.message : 'Failed to import full backup.');
    } finally {
      setIsApplyingFullBackupImport(false);
    }
  };

  return (
    <SettingsDetailLayout title="Data Transfer" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Full Backup</h2>
          <IconButton
            icon={<ExportIcon className="settings-view__export-icon" />}
            ariaLabel={isExportingFullBackup ? 'Exporting...' : 'Export full backup'}
            onClick={() => {
              void handleExportFullBackup();
            }}
            disabled={isExportingFullBackup || isApplyingFullBackupImport}
          />
        </div>
        <p className="settings-view__helper">
          Export the entire local database for backup, browser migration, or disaster recovery.
        </p>
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Full Backup</h2>
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel={isLoadingFullBackupPreview ? 'Reading...' : 'Choose backup JSON'}
            onClick={() => fullBackupFileInputRef.current?.click()}
            disabled={isLoadingFullBackupPreview || isApplyingFullBackupImport || isExportingFullBackup}
          />
        </div>
        <p className="settings-view__helper">
          Restore a complete backup and replace every local record on this device.
        </p>
        <p className="settings-view__helper">
          This is irreversible. After a successful restore, the page reloads so every in-memory store re-reads IndexedDB.
        </p>
        <input
          ref={fullBackupFileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFullBackupFileChange}
        />

        {fullBackupPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              <strong>18 stores</strong> · {sumBackupCounts(fullBackupPreview.counts)} records
            </div>
            <div className="settings-view__row-detail">
              {formatBackupSummary(fullBackupPreview.counts)}
            </div>
            <div className="settings-view__row-detail">
              Exported: {new Date(fullBackupPreview.exportedAt).toLocaleString()}
            </div>
            <div className="settings-view__row-detail">
              Snapshot format v{fullBackupPreview.snapshotFormatVersion} · IndexedDB schema {fullBackupPreview.idbSchemaVersion}
            </div>
            <div className="settings-view__row-detail">
              Execution returns: {fullBackupPreview.counts.executionReturns} envelopes · {fullBackupPreview.counts.executionReturnLineItems} line items · {fullBackupPreview.counts.executionReturnUnplannedTasks} unplanned task snapshots
            </div>
            <div className="settings-view__row-detail">
              Singletons: {fullBackupPreview.counts.globalTagSequence} global tag sequence · {fullBackupPreview.counts.crewPool} crew pool
            </div>
            {fullBackupPreview.warnings.map((warning) => (
              <div key={warning} className="settings-view__row-detail">
                {warning}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => setIsFullBackupConfirmOpen(true)}
                disabled={isApplyingFullBackupImport}
              >
                Review Restore
              </button>
            </div>
          </div>
        )}

        {fullBackupMessage && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {fullBackupMessage}
          </p>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Plan Package</h2>
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel={isLoadingPlanPreview ? 'Reading...' : 'Choose JSON'}
            onClick={() => planFileInputRef.current?.click()}
            disabled={isLoadingPlanPreview || isApplyingPlanImport}
          />
        </div>
        <p className="settings-view__helper">
          Import planner package exports for Field Plan execution.
        </p>
        <input
          ref={planFileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handlePlanFileChange}
        />

        {planPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              <strong>{planPreview.title}</strong> · {planPreview.lineItemCount} line items · {planPreview.workTypeCount} work types · {planPreview.workUnitCount} units · {planPreview.projectCount} projects · {planPreview.tagCount} tags
            </div>
            <div className="settings-view__row-detail">
              Last modified: {new Date(planPreview.lastModifiedAt).toLocaleString()}
            </div>
            {planPreview.conflict === 'planner-plan' && (
              <div className="settings-view__row-detail">
                Conflict: this plan ID exists as a planner plan on this device. Import blocked.
              </div>
            )}
            {planPreview.conflict === 'replace-or-skip' && (
              <div className="settings-view__row-detail">
                Existing received plan found with no execution state. Choose replace or skip.
              </div>
            )}
            {planPreview.conflict === 'merge' && (
              <div className="settings-view__row-detail">
                Existing received plan has execution state. Import will merge and preserve executor annotations.
              </div>
            )}
            {planPreview.lineItemDiffSummary && (
              <div className="settings-view__row-detail" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Line item changes:</span>
                {planPreview.lineItemDiffSummary.new > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--new">
                    {planPreview.lineItemDiffSummary.new} new
                  </span>
                )}
                {planPreview.lineItemDiffSummary.updated > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--updated">
                    {planPreview.lineItemDiffSummary.updated} updated
                  </span>
                )}
                {planPreview.lineItemDiffSummary.unchanged > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--unchanged">
                    {planPreview.lineItemDiffSummary.unchanged} unchanged
                  </span>
                )}
                {planPreview.lineItemDiffSummary.removed > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--removed">
                    {planPreview.lineItemDiffSummary.removed} removed
                  </span>
                )}
              </div>
            )}
            <WorkUnitImportPreviewPanel
              preview={planWorkUnitPreview}
              applyImportedLabels={applyPlanUnitLabels}
              onApplyImportedLabelsChange={setApplyPlanUnitLabels}
              summaryElement="div"
              summaryClassName="settings-view__row-detail"
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  void handleApplyPlanImport('replace');
                }}
                disabled={isApplyingPlanImport || planPreview.conflict === 'planner-plan'}
              >
                {isApplyingPlanImport ? 'Applying...' : planPreview.conflict === 'merge' ? 'Merge Import' : 'Apply Import'}
              </button>
              {planPreview.conflict === 'replace-or-skip' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    void handleApplyPlanImport('skip');
                  }}
                  disabled={isApplyingPlanImport}
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        {planImportMessage && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {planImportMessage}
          </p>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Execution Return</h2>
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel={isLoadingExecutionPreview ? 'Reading...' : 'Choose JSON'}
            onClick={() => executionFileInputRef.current?.click()}
            disabled={isLoadingExecutionPreview || isApplyingExecutionImport}
          />
        </div>
        <p className="settings-view__helper">
          Import execution returns sent by the field manager for planner review.
        </p>
        <p className="settings-view__helper">
          {PLANNER_EXECUTION_RETURN_EXPLANATION} {CANONICAL_HANDOFF_EXPLANATION}
        </p>
        <input
          ref={executionFileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleExecutionFileChange}
        />

        {executionPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              <strong>{executionPreview.planTitle}</strong> · {executionPreview.lineItemCount} line items · {executionPreview.timeEntryCount} time entries · {executionPreview.workUnitCount} units
            </div>
            <div className="settings-view__row-detail">
              Session closed: {new Date(executionPreview.closedAt).toLocaleString()}
            </div>
            <WorkUnitImportPreviewPanel
              preview={executionWorkUnitPreview}
              applyImportedLabels={applyExecutionUnitLabels}
              onApplyImportedLabelsChange={setApplyExecutionUnitLabels}
              summaryElement="div"
              summaryClassName="settings-view__row-detail"
            />
            <div className="settings-view__row-detail">
              Date range: {executionPreview.dateRangeStart ? new Date(executionPreview.dateRangeStart).toLocaleString() : '—'} → {executionPreview.dateRangeEnd ? new Date(executionPreview.dateRangeEnd).toLocaleString() : '—'}
            </div>
            <div className="settings-view__row-detail">
              Unplanned tasks: {executionPreview.unplannedTaskCount}
            </div>
            {executionPreview.duplicateTimeEntryIds.length > 0 && (
              <div className="settings-view__row-detail">
                {executionPreview.duplicateTimeEntryIds.length} duplicate time entry IDs will be skipped.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  void handleApplyExecutionImport();
                }}
                disabled={isApplyingExecutionImport}
              >
                {isApplyingExecutionImport ? 'Applying...' : 'Apply Import'}
              </button>
            </div>
          </div>
        )}

        {executionImportMessage && (
          <div style={{ marginTop: 12 }}>
            <p className="settings-view__helper">
              {executionImportMessage}
            </p>
            {executionMergeSummary && (
              <>
                <p className="settings-view__helper">
                  Last merge: {new Date(executionMergeSummary.importedAt).toLocaleString()}
                </p>
                <p className="settings-view__helper">
                  {formatExecutionReturnMergeSummary(executionMergeSummary)}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <AlertDialog
        isOpen={isFullBackupConfirmOpen}
        tone="danger"
        title="Replace all local data?"
        description="This full backup import is irreversible. It replaces everything on this device and reloads the page after restore."
        onClose={() => {
          if (isApplyingFullBackupImport) return;
          setIsFullBackupConfirmOpen(false);
        }}
        ariaLabelledBy="full-backup-confirm-title"
        ariaDescribedBy="full-backup-confirm-desc"
        actions={[
          {
            label: 'Cancel',
            onClick: () => setIsFullBackupConfirmOpen(false),
            variant: 'secondary',
            disabled: isApplyingFullBackupImport,
          },
          {
            label: isApplyingFullBackupImport ? 'Restoring...' : 'Replace All Data',
            onClick: () => {
              void handleApplyFullBackupImport();
            },
            variant: 'danger',
            disabled: isApplyingFullBackupImport || !fullBackupPreview?.isCompatible,
          },
        ]}
      >
        {fullBackupPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              Backup summary: {formatBackupSummary(fullBackupPreview.counts)}
            </div>
            <div className="settings-view__row-detail">
              Total records: {sumBackupCounts(fullBackupPreview.counts)}
            </div>
            {!fullBackupPreview.isCompatible && fullBackupPreview.warnings.map((warning) => (
              <div key={warning} className="settings-view__row-detail">
                {warning}
              </div>
            ))}
          </div>
        )}
      </AlertDialog>
    </SettingsDetailLayout>
  );
}

import { useRef, useState, type ChangeEvent } from 'react';
import { ImportIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import {
  applyExecutionReturnImport,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from '../../lib/interop/data-transfer/execution-return-import';
import type {
  ExecutionReturnImportPreview,
  PlanPackageImportPreview,
} from '../../lib/interop/data-transfer/contracts';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

interface SettingsDataTransferViewProps {
  onBack: () => void;
}

export function SettingsDataTransferView({ onBack }: SettingsDataTransferViewProps) {
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const executionFileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingPlanPreview, setIsLoadingPlanPreview] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanPackageImportPreview | null>(null);
  const [planImportMessage, setPlanImportMessage] = useState<string | null>(null);
  const [isApplyingPlanImport, setIsApplyingPlanImport] = useState(false);

  const [isLoadingExecutionPreview, setIsLoadingExecutionPreview] = useState(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionReturnImportPreview | null>(null);
  const [executionImportMessage, setExecutionImportMessage] = useState<string | null>(null);
  const [isApplyingExecutionImport, setIsApplyingExecutionImport] = useState(false);

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
      const result = await applyPlanPackageImport(planPreview, resolution);
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
      const result = await applyExecutionReturnImport(executionPreview);
      setExecutionImportMessage(result.reason);
      setExecutionPreview(null);
      trackTelemetryEvent('interop_execution_return_import');
    } catch {
      setExecutionImportMessage('Failed to import execution return.');
      trackTelemetryEvent('interop_execution_return_import_failed');
    } finally {
      setIsApplyingExecutionImport(false);
    }
  };

  return (
    <SettingsDetailLayout title="Data Transfer" onBack={onBack}>
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
              <strong>{planPreview.title}</strong> · {planPreview.lineItemCount} line items · {planPreview.workTypeCount} work types
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
          Import executor execution-return exports for planner wrap-up review.
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
              <strong>{executionPreview.planTitle}</strong> · {executionPreview.lineItemCount} line items · {executionPreview.timeEntryCount} time entries
            </div>
            <div className="settings-view__row-detail">
              Session closed: {new Date(executionPreview.closedAt).toLocaleString()}
            </div>
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
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {executionImportMessage}
          </p>
        )}
      </div>
    </SettingsDetailLayout>
  );
}

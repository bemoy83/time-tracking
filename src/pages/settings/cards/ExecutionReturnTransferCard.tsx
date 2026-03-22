import { useRef, useState, type ChangeEvent } from 'react';
import { ImportIcon } from '../../../components/icons';
import { IconButton } from '../../../components/IconButton';
import { WorkUnitImportPreviewPanel } from '../../../components/WorkUnitImportPreviewPanel';
import type {
  ExecutionReturnImportPreview,
  ExecutionReturnMergeSummary,
} from '../../../lib/interop/data-transfer/contracts';
import {
  applyExecutionReturnImport,
  formatExecutionReturnMergeSummary,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from '../../../lib/interop/data-transfer/execution-return-import';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../../lib/interop/data-transfer/handoff-copy';
import { useWorkUnitImportPreview } from '../../../lib/hooks/useWorkUnitImportPreview';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';
import { useWorkUnitStore } from '../../../lib/stores/work-unit-store';

export function ExecutionReturnTransferCard() {
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const executionFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingExecutionPreview, setIsLoadingExecutionPreview] = useState(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionReturnImportPreview | null>(null);
  const [executionImportMessage, setExecutionImportMessage] = useState<string | null>(null);
  const [isApplyingExecutionImport, setIsApplyingExecutionImport] = useState(false);
  const [executionMergeSummary, setExecutionMergeSummary] = useState<ExecutionReturnMergeSummary | null>(null);
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

  return (
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
        aria-label="Import execution return file"
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
  );
}

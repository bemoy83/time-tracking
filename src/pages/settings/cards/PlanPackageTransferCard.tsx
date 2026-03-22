import { useRef, useState, type ChangeEvent } from 'react';
import { ImportIcon } from '../../../components/icons';
import { IconButton } from '../../../components/IconButton';
import { WorkUnitImportPreviewPanel } from '../../../components/WorkUnitImportPreviewPanel';
import type { PlanPackageImportPreview } from '../../../lib/interop/data-transfer/contracts';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../../lib/interop/data-transfer/plan-package';
import { useWorkUnitImportPreview } from '../../../lib/hooks/useWorkUnitImportPreview';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';
import { useWorkUnitStore } from '../../../lib/stores/work-unit-store';

export function PlanPackageTransferCard() {
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingPlanPreview, setIsLoadingPlanPreview] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanPackageImportPreview | null>(null);
  const [planImportMessage, setPlanImportMessage] = useState<string | null>(null);
  const [isApplyingPlanImport, setIsApplyingPlanImport] = useState(false);
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

  return (
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
        aria-label="Import plan package file"
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
  );
}

import { useRef, useState, type ChangeEvent } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import type { PlanPackageImportPreview } from '../../lib/interop/data-transfer/contracts';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

interface SettingsDataTransferViewProps {
  onBack: () => void;
}

export function SettingsDataTransferView({ onBack }: SettingsDataTransferViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PlanPackageImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setImportMessage(null);
    setPreview(null);
    setIsLoadingPreview(true);
    try {
      const text = await file.text();
      const parsed = parsePlanPackageJson(text);
      if (!parsed.ok) {
        setImportMessage(parsed.error);
        return;
      }
      const nextPreview = await previewPlanPackageImport(parsed.envelope);
      setPreview(nextPreview);
      trackTelemetryEvent('interop_plan_package_preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleApply = async (resolution: 'replace' | 'skip' = 'replace') => {
    if (!preview) return;
    setIsApplying(true);
    try {
      const result = await applyPlanPackageImport(preview, resolution);
      setImportMessage(result.reason);
      if (result.applied) {
        setPreview(null);
        trackTelemetryEvent(result.merged ? 'interop_plan_package_merge' : 'interop_plan_package_import');
      } else if (resolution === 'skip') {
        trackTelemetryEvent('interop_plan_package_skip');
      } else {
        trackTelemetryEvent('interop_plan_package_conflict');
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <SettingsDetailLayout title="Data Transfer" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Plan Package</h2>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingPreview || isApplying}
          >
            {isLoadingPreview ? 'Reading...' : 'Choose JSON'}
          </button>
        </div>
        <p className="settings-view__helper">
          Import planner package exports for Field Plan execution.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {preview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              <strong>{preview.title}</strong> · {preview.lineItemCount} line items · {preview.workTypeCount} work types
            </div>
            <div className="settings-view__row-detail">
              Last modified: {new Date(preview.lastModifiedAt).toLocaleString()}
            </div>
            {preview.conflict === 'planner-plan' && (
              <div className="settings-view__row-detail">
                Conflict: this plan ID exists as a planner plan on this device. Import blocked.
              </div>
            )}
            {preview.conflict === 'replace-or-skip' && (
              <div className="settings-view__row-detail">
                Existing received plan found with no execution state. Choose replace or skip.
              </div>
            )}
            {preview.conflict === 'merge' && (
              <div className="settings-view__row-detail">
                Existing received plan has execution state. Import will merge and preserve executor annotations.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  void handleApply('replace');
                }}
                disabled={isApplying || preview.conflict === 'planner-plan'}
              >
                {isApplying ? 'Applying...' : preview.conflict === 'merge' ? 'Merge Import' : 'Apply Import'}
              </button>
              {preview.conflict === 'replace-or-skip' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    void handleApply('skip');
                  }}
                  disabled={isApplying}
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        {importMessage && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {importMessage}
          </p>
        )}
      </div>
    </SettingsDetailLayout>
  );
}

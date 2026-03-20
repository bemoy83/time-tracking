import { ImportIcon } from '../../../components/icons';
import { IconButton } from '../../../components/IconButton';
import { WorkUnitImportPreviewPanel } from '../../../components/WorkUnitImportPreviewPanel';
import type { ImportPreview } from '../../../lib/interop/import-preview';
import type { WorkUnitImportPreview } from '../../../lib/interop/work-unit-import-preview';

interface WorkPackageImportCardProps {
  title?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  preview: ImportPreview | null;
  isLoadingPreview: boolean;
  isApplying: boolean;
  importApplyGateOpen: boolean;
  onApply: () => void;
  applySummary: string | null;
  workUnitPreview?: WorkUnitImportPreview | null;
  applyImportedUnitLabels?: boolean;
  onToggleApplyImportedUnitLabels?: (value: boolean) => void;
}

export function WorkPackageImportCard({
  title = 'Import Work Packages',
  fileInputRef,
  onFileChange,
  preview,
  isLoadingPreview,
  isApplying,
  importApplyGateOpen,
  onApply,
  applySummary,
  workUnitPreview = null,
  applyImportedUnitLabels = false,
  onToggleApplyImportedUnitLabels,
}: WorkPackageImportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">{title}</h2>
        <IconButton
          icon={<ImportIcon className="settings-view__import-icon" />}
          ariaLabel={isLoadingPreview ? 'Loading...' : 'Import'}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoadingPreview || isApplying}
        />
      </div>
      <p className="settings-view__helper">
        Choose a CSV file (title, workTypeTitle, workUnit, phase, ...)
      </p>

      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {preview && (
        <section className="field-plan-import-card" style={{ marginTop: 12 }}>
          <p className="field-plan-import-card__title">
            <strong>
              {preview.summary.create} create · {preview.summary.update} update · {preview.summary.skip} skip
            </strong>
          </p>
          {preview.duplicateKeys.length > 0 && (
            <p className="field-plan-import-card__meta">
              Duplicate mapping keys: {preview.duplicateKeys.length}. Resolve before apply.
            </p>
          )}
          {workUnitPreview && onToggleApplyImportedUnitLabels && (
            <WorkUnitImportPreviewPanel
              preview={workUnitPreview}
              applyImportedLabels={applyImportedUnitLabels}
              onApplyImportedLabelsChange={onToggleApplyImportedUnitLabels}
              toggleStyle={{ marginTop: 8 }}
            />
          )}
          <div className="field-plan-import-card__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isApplying || preview.duplicateKeys.length > 0 || !importApplyGateOpen}
              onClick={onApply}
            >
              {isApplying ? 'Applying...' : !importApplyGateOpen ? 'Blocked by quality gate' : 'Apply Import'}
            </button>
          </div>
        </section>
      )}

      {applySummary && (
        <p className="settings-view__helper" style={{ marginTop: 12 }}>
          {applySummary}
        </p>
      )}
    </div>
  );
}

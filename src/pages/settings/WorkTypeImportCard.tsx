import { ImportIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import type { WorkTypeImportPreview } from '../../lib/interop/work-type-import';

interface WorkTypeImportCardProps {
  summaryMessage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  preview: WorkTypeImportPreview | null;
  isLoadingPreview: boolean;
  isApplying: boolean;
  onApply: () => void;
}

export function WorkTypeImportCard({
  summaryMessage,
  fileInputRef,
  onFileChange,
  preview,
  isLoadingPreview,
  isApplying,
  onApply,
}: WorkTypeImportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Import Work Types</h2>
        <IconButton
          icon={<ImportIcon className="settings-view__import-icon" />}
          ariaLabel={isLoadingPreview ? 'Loading...' : 'Import'}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoadingPreview || isApplying}
        />
      </div>
      <p className="settings-view__helper">
        Choose a CSV file (title, workUnit, assemblyRate, dismantleRate)
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
            <strong>{preview.summary.create} create</strong> · {preview.summary.update} update
          </p>
          {preview.duplicateKeys.length > 0 && (
            <p className="field-plan-import-card__meta">
              Duplicate mapping keys: {preview.duplicateKeys.length}. Resolve before apply.
            </p>
          )}
          <div className="field-plan-import-card__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isApplying || preview.duplicateKeys.length > 0}
              onClick={onApply}
            >
              {isApplying ? 'Applying...' : 'Apply Import'}
            </button>
          </div>
        </section>
      )}

      {summaryMessage && (
        <p className="settings-view__helper" style={{ marginTop: 12 }}>
          {summaryMessage}
        </p>
      )}
    </div>
  );
}

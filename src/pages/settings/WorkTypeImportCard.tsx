import { CsvImportInput } from '../../components/CsvImportInput';
import type { WorkTypeImportPreview } from '../../lib/interop/work-type-import';

interface WorkTypeImportCardProps {
  summaryMessage: string | null;
  csvInput: string;
  onCsvInputChange: (value: string) => void;
  onParse: () => void;
  parseErrors: string[];
  preview: WorkTypeImportPreview | null;
  isApplying: boolean;
  onApply: () => void;
}

export function WorkTypeImportCard({
  summaryMessage,
  csvInput,
  onCsvInputChange,
  onParse,
  parseErrors,
  preview,
  isApplying,
  onApply,
}: WorkTypeImportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Import Work Types</h2>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onParse}>
          Parse + Preview
        </button>
      </div>
      <p className="settings-view__helper">Paste CSV or choose a file (title, workUnit, buildPhase, expectedProductivity)</p>
      <CsvImportInput
        value={csvInput}
        onChange={onCsvInputChange}
        onFileLoaded={onParse}
        placeholder="title,workUnit,buildPhase,expectedProductivity"
        rows={8}
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
            {preview.summary.create} create · {preview.summary.update} update
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
            onClick={onApply}
          >
            {isApplying ? 'Applying...' : 'Apply Import'}
          </button>
        </div>
      )}

      {summaryMessage && (
        <p className="settings-view__helper" style={{ marginTop: 12 }}>
          {summaryMessage}
        </p>
      )}
    </div>
  );
}

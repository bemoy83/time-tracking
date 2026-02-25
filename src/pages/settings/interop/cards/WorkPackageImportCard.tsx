import type { ImportPreview } from '../../../../lib/interop/import-preview';

interface WorkPackageImportCardProps {
  csvInput: string;
  onCsvInputChange: (value: string) => void;
  onParse: () => void;
  parseErrors: string[];
  preview: ImportPreview | null;
  isApplying: boolean;
  importApplyGateOpen: boolean;
  onApply: () => void;
  applySummary: string | null;
}

export function WorkPackageImportCard({
  csvInput,
  onCsvInputChange,
  onParse,
  parseErrors,
  preview,
  isApplying,
  importApplyGateOpen,
  onApply,
  applySummary,
}: WorkPackageImportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Import Work Packages</h2>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onParse}>
          Parse + Preview
        </button>
      </div>
      <p className="settings-view__helper">Paste CSV (title, workTypeTitle, workUnit, buildPhase, ...)</p>
      <textarea
        className="input"
        rows={8}
        value={csvInput}
        onChange={(event) => onCsvInputChange(event.target.value)}
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
            onClick={onApply}
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
  );
}

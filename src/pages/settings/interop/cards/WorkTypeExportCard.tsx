interface WorkTypeExportCardProps {
  isExporting: boolean;
  onExport: () => void;
  summaryMessage: string | null;
}

export function WorkTypeExportCard({
  isExporting,
  onExport,
  summaryMessage,
}: WorkTypeExportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Export Work Types</h2>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
      <p className="settings-view__helper">Export work type definitions as CSV.</p>
      {summaryMessage && (
        <p className="settings-view__helper" style={{ marginTop: 12 }}>
          {summaryMessage}
        </p>
      )}
    </div>
  );
}

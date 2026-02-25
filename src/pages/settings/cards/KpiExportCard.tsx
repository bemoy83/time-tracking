import type { ExportProfile } from '../../../lib/interop/export';

interface KpiExportCardProps {
  exportProfile: ExportProfile;
  isExporting: boolean;
  onExport: () => void;
  onExportProfileChange: (profile: ExportProfile) => void;
}

export function KpiExportCard({
  exportProfile,
  isExporting,
  onExport,
  onExportProfileChange,
}: KpiExportCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Export KPI CSV</h2>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
      <p className="settings-view__helper">Export archive-grade KPI profiles</p>
      <label className="settings-view__row">
        <span className="settings-view__row-label">Profile</span>
        <select
          className="input"
          value={exportProfile}
          onChange={(event) => onExportProfileChange(event.target.value as ExportProfile)}
        >
          <option value="ops_summary">Ops Summary</option>
          <option value="estimator_summary">Estimator Summary</option>
          <option value="phase_summary">Phase Summary</option>
        </select>
      </label>
    </div>
  );
}

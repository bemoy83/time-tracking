import type { MaintenanceReport } from '../../../../lib/archive/maintenance';
import type { RecomputedArchiveKpiGroup } from '../../../../lib/archive/recompute';
import type { RecomputeChangeReport } from '../../../../lib/archive/recompute-report';

interface ArchiveMaintenanceCardProps {
  maintenanceReport: MaintenanceReport | null;
  isRunningMaintenance: boolean;
  onRunMaintenance: () => void;
  archiveGroups: RecomputedArchiveKpiGroup[] | null;
  recomputeReport: RecomputeChangeReport | null;
  isRecomputingArchive: boolean;
  archiveRecomputeGateOpen: boolean;
  onRecomputeArchivedKpis: () => void;
}

export function ArchiveMaintenanceCard({
  maintenanceReport,
  isRunningMaintenance,
  onRunMaintenance,
  archiveGroups,
  recomputeReport,
  isRecomputingArchive,
  archiveRecomputeGateOpen,
  onRecomputeArchivedKpis,
}: ArchiveMaintenanceCardProps) {
  return (
    <div className="settings-view__card">
      <div className="settings-view__card-header">
        <h2 className="settings-view__sub-header">Archive Maintenance</h2>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onRunMaintenance}
          disabled={isRunningMaintenance}
        >
          {isRunningMaintenance ? 'Running...' : 'Run Integrity Scan'}
        </button>
      </div>
      <p className="settings-view__helper">Scan archived records and pending archival tasks for integrity issues.</p>

      {maintenanceReport && (
        <div className="settings-view__list" style={{ marginTop: 12 }}>
          <div className="settings-view__row-detail">
            Archived scanned: {maintenanceReport.archivedCount} · Pending: {maintenanceReport.pendingCount}
          </div>
          <div className="settings-view__row-detail">
            Archived issues: {maintenanceReport.archivedIssues.length} · Archive-ready: {maintenanceReport.archiveCandidates.length} · Blocked: {maintenanceReport.blockedFromArchival.length}
          </div>
          {maintenanceReport.archivedIssues.slice(0, 3).map((issue) => (
            <div key={`${issue.taskId}-${issue.issue.type}`} className="settings-view__row-detail">
              {issue.taskId}: {issue.description}
            </div>
          ))}
        </div>
      )}

      <div className="settings-view__card-header" style={{ marginTop: 12 }}>
        <h3 className="settings-view__sub-header" style={{ fontSize: '1rem' }}>Archived KPI Recompute</h3>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onRecomputeArchivedKpis}
          disabled={isRecomputingArchive || !archiveRecomputeGateOpen}
        >
          {isRecomputingArchive ? 'Recomputing...' : !archiveRecomputeGateOpen ? 'Blocked by quality gate' : 'Recompute KPIs'}
        </button>
      </div>
      <p className="settings-view__helper">Recompute archive-grade KPIs by archive engine version and report what changed.</p>

      {archiveGroups && (
        <div className="settings-view__list" style={{ marginTop: 12 }}>
          {archiveGroups.map((group) => (
            <div key={group.archiveVersion} className="settings-view__row-detail">
              {group.archiveVersion}: {group.taskCount} tasks · {group.kpis.length} KPI rows
            </div>
          ))}
        </div>
      )}
      {recomputeReport && (
        <div className="settings-view__list" style={{ marginTop: 8 }}>
          <div className="settings-view__row-detail">
            Changes: {recomputeReport.totalChanges} total ({recomputeReport.totalAdded} added · {recomputeReport.totalChanged} changed · {recomputeReport.totalRemoved} removed)
          </div>
          {recomputeReport.changes.slice(0, 5).map((change) => (
            <div key={`${change.archiveVersion}-${change.key}-${change.status}`} className="settings-view__row-detail">
              {change.archiveVersion} · {change.key} · {change.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

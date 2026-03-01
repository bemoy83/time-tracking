import { useState } from 'react';
import { archiveTask } from '../../../lib/archive/archive-action';
import { runMaintenanceScanFromDb, type MaintenanceReport } from '../../../lib/archive/maintenance';
import { recomputeArchivedKpisByVersion, type RecomputedArchiveKpiGroup } from '../../../lib/archive/recompute';
import { createRecomputeChangeReport, type RecomputeChangeReport } from '../../../lib/archive/recompute-report';
import { getAttributionPolicy } from '../../../lib/stores/attribution-settings';
import { getOutlierHandlingMode } from '../../../lib/stores/kpi-settings';
import { refreshTasks } from '../../../lib/stores/task-store';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';

interface UseArchiveMaintenanceOptions {
  onSummary: (summary: string) => void;
}

export function useArchiveMaintenance({ onSummary }: UseArchiveMaintenanceOptions) {
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceReport | null>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [isArchivingPending, setIsArchivingPending] = useState(false);
  const [archiveGroups, setArchiveGroups] = useState<RecomputedArchiveKpiGroup[] | null>(null);
  const [recomputeReport, setRecomputeReport] = useState<RecomputeChangeReport | null>(null);
  const [isRecomputingArchive, setIsRecomputingArchive] = useState(false);

  const handleRunMaintenance = async () => {
    setIsRunningMaintenance(true);
    try {
      const report = await runMaintenanceScanFromDb();
      setMaintenanceReport(report);
      trackTelemetryEvent('archive_maintenance_scan');
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  const handleArchiveCandidates = async () => {
    const candidates = maintenanceReport?.archiveCandidates ?? [];
    if (candidates.length === 0) return;
    setIsArchivingPending(true);
    try {
      let archived = 0;
      let failed = 0;
      for (const taskId of candidates) {
        try {
          const result = await archiveTask(taskId);
          if (result.success) archived++;
          else failed++;
        } catch {
          failed++;
        }
      }
      await refreshTasks();
      const report = await runMaintenanceScanFromDb();
      setMaintenanceReport(report);
      onSummary(`Archived ${archived} task(s).${failed > 0 ? ` ${failed} failed integrity.` : ''}`);
      trackTelemetryEvent('archive_maintenance_archive_candidates');
    } finally {
      setIsArchivingPending(false);
    }
  };

  const handleRecomputeArchivedKpis = async () => {
    setIsRecomputingArchive(true);
    try {
      const policy = getAttributionPolicy();
      const outlierMode = getOutlierHandlingMode();
      const result = await recomputeArchivedKpisByVersion({
        policy,
        outlierMode,
      });

      if (archiveGroups) {
        setRecomputeReport(createRecomputeChangeReport(archiveGroups, result.groups));
      } else {
        setRecomputeReport(null);
      }
      setArchiveGroups(result.groups);
      onSummary(
        `Recomputed archived KPIs across ${result.groups.length} archive version group(s) and ${result.totalArchivedTasks} archived tasks.`,
      );
      trackTelemetryEvent('archive_kpi_recompute');
    } finally {
      setIsRecomputingArchive(false);
    }
  };

  return {
    maintenanceReport,
    isRunningMaintenance,
    isArchivingPending,
    handleArchiveCandidates,
    archiveGroups,
    recomputeReport,
    isRecomputingArchive,
    handleRunMaintenance,
    handleRecomputeArchivedKpis,
  };
}

import { useState } from 'react';
import { runMaintenanceScanFromDb, type MaintenanceReport } from '../../../lib/archive/maintenance';
import { recomputeArchivedKpisByVersion, type RecomputedArchiveKpiGroup } from '../../../lib/archive/recompute';
import { createRecomputeChangeReport, type RecomputeChangeReport } from '../../../lib/archive/recompute-report';
import { getAttributionPolicy } from '../../../lib/stores/attribution-settings';
import { getOutlierHandlingMode } from '../../../lib/stores/kpi-settings';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';

interface UseArchiveMaintenanceOptions {
  onSummary: (summary: string) => void;
}

export function useArchiveMaintenance({ onSummary }: UseArchiveMaintenanceOptions) {
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceReport | null>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
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
    archiveGroups,
    recomputeReport,
    isRecomputingArchive,
    handleRunMaintenance,
    handleRecomputeArchivedKpis,
  };
}

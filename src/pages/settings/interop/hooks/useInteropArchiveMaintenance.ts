import { useState } from 'react';
import { runMaintenanceScanFromDb, type MaintenanceReport } from '../../../../lib/archive/maintenance';
import { recomputeArchivedKpisByVersion, type RecomputedArchiveKpiGroup } from '../../../../lib/archive/recompute';
import { createRecomputeChangeReport, type RecomputeChangeReport } from '../../../../lib/archive/recompute-report';
import { getFeatureFlag } from '../../../../lib/flags/feature-flags';
import { isRolloutGateOpen, ARCHIVE_RECOMPUTE_GATE } from '../../../../lib/flags/rollout-gates';
import { getAttributionPolicy } from '../../../../lib/stores/attribution-settings';
import { getOutlierHandlingMode } from '../../../../lib/stores/kpi-settings';
import { trackTelemetryEvent } from '../../../../lib/telemetry/telemetry';

interface UseInteropArchiveMaintenanceOptions {
  onSummary: (summary: string) => void;
}

export function useInteropArchiveMaintenance({ onSummary }: UseInteropArchiveMaintenanceOptions) {
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceReport | null>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [archiveGroups, setArchiveGroups] = useState<RecomputedArchiveKpiGroup[] | null>(null);
  const [recomputeReport, setRecomputeReport] = useState<RecomputeChangeReport | null>(null);
  const [isRecomputingArchive, setIsRecomputingArchive] = useState(false);

  const archiveToolsEnabled = getFeatureFlag('archiveMaintenanceTools');
  const archiveRecomputeGateOpen = isRolloutGateOpen(ARCHIVE_RECOMPUTE_GATE);

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
    archiveToolsEnabled,
    maintenanceReport,
    isRunningMaintenance,
    archiveGroups,
    recomputeReport,
    isRecomputingArchive,
    archiveRecomputeGateOpen,
    handleRunMaintenance,
    handleRecomputeArchivedKpis,
  };
}

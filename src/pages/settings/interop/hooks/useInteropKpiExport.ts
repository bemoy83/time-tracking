import { useState } from 'react';
import { buildAttributedRollup } from '../../../../lib/attributed-rollup';
import { computeWorkTypeKpis } from '../../../../lib/kpi';
import { downloadCsv } from '../../../../lib/interop/download-csv';
import { exportKpis, type ExportProfile } from '../../../../lib/interop/export';
import { getOutlierHandlingMode } from '../../../../lib/stores/kpi-settings';
import type { Task, WorkType } from '../../../../lib/types';

interface UseInteropKpiExportOptions {
  tasks: Task[];
  workTypes: WorkType[];
  onSummary: (summary: string) => void;
}

export function useInteropKpiExport({
  tasks,
  workTypes,
  onSummary,
}: UseInteropKpiExportOptions) {
  const [exportProfile, setExportProfile] = useState<ExportProfile>('ops_summary');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const completedTasks = tasks.filter((task) => task.status === 'completed');
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const outlierMode = getOutlierHandlingMode();
      const kpis = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        archiveOnly: true,
        workTypes,
        outlierMode,
      });

      const csv = exportKpis(kpis, exportProfile);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`kpi-${exportProfile}-${stamp}.csv`, csv);
      onSummary(`Exported ${kpis.length} KPI rows.`);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportProfile,
    setExportProfile,
    isExporting,
    handleExport,
  };
}

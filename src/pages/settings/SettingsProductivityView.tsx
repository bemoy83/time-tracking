import { useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { KpiSection } from '../../components/KpiSection';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { getOutlierHandlingMode, setOutlierHandlingMode } from '../../lib/stores/kpi-settings';
import type { OutlierHandlingMode } from '../../lib/kpi';
import { KpiExportCard } from './cards/KpiExportCard';
import { ArchiveMaintenanceCard } from './cards/ArchiveMaintenanceCard';
import { useKpiExport } from './hooks/useKpiExport';
import { useArchiveMaintenance } from './hooks/useArchiveMaintenance';
import './settings-styles';

interface SettingsProductivityViewProps {
  onBack: () => void;
}

export function SettingsProductivityView({ onBack }: SettingsProductivityViewProps) {
  const { tasks } = useTaskStore();
  const { workTypes } = useWorkTypeStore();
  const [showCalculator, setShowCalculator] = useState(false);
  const [outlierMode, setOutlierMode] = useState<OutlierHandlingMode>(getOutlierHandlingMode);
  const [exportSummary, setExportSummary] = useState<string | null>(null);

  const kpiExport = useKpiExport({
    tasks,
    workTypes,
    onSummary: setExportSummary,
  });

  const archiveMaintenance = useArchiveMaintenance({
    onSummary: setExportSummary,
  });

  return (
    <SettingsDetailLayout title="Productivity" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Productivity</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowCalculator(true)}
          >
            Calculator
          </button>
        </div>
        <p className="settings-view__helper">View KPIs and use the estimate calculator.</p>
        <label className="productivity__outlier-control">
          <span className="productivity__outlier-label">Outlier Handling</span>
          <select
            className="input"
            value={outlierMode}
            onChange={(event) => {
              const next = event.target.value as OutlierHandlingMode;
              setOutlierMode(next);
              setOutlierHandlingMode(next);
            }}
          >
            <option value="report_only">Report only (default)</option>
            <option value="exclude_from_rate">Exclude from KPI averages</option>
          </select>
        </label>
        <KpiSection tasks={tasks} outlierMode={outlierMode} />
      </div>

      <KpiExportCard
        exportProfile={kpiExport.exportProfile}
        isExporting={kpiExport.isExporting}
        onExport={() => {
          void kpiExport.handleExport();
        }}
        onExportProfileChange={kpiExport.setExportProfile}
      />

      <ArchiveMaintenanceCard
        maintenanceReport={archiveMaintenance.maintenanceReport}
        isRunningMaintenance={archiveMaintenance.isRunningMaintenance}
        isArchivingPending={archiveMaintenance.isArchivingPending}
        onRunMaintenance={() => {
          void archiveMaintenance.handleRunMaintenance();
        }}
        onArchiveCandidates={() => {
          void archiveMaintenance.handleArchiveCandidates();
        }}
        archiveGroups={archiveMaintenance.archiveGroups}
        recomputeReport={archiveMaintenance.recomputeReport}
        isRecomputingArchive={archiveMaintenance.isRecomputingArchive}
        onRecomputeArchivedKpis={() => {
          void archiveMaintenance.handleRecomputeArchivedKpis();
        }}
      />

      {exportSummary && (
        <p className="settings-view__helper" style={{ marginTop: 12 }}>
          {exportSummary}
        </p>
      )}

      <CalculatorSheet
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        tasks={tasks}
        outlierMode={outlierMode}
      />
    </SettingsDetailLayout>
  );
}

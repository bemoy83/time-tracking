import { useMemo } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { useTaskStore } from '../../lib/stores/task-store';
import { useTemplateStore } from '../../lib/stores/template-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { WorkTypeImportCard } from './WorkTypeImportCard';
import { ArchiveMaintenanceCard } from './interop/cards/ArchiveMaintenanceCard';
import { KpiExportCard } from './interop/cards/KpiExportCard';
import { WorkPackageImportCard } from './interop/cards/WorkPackageImportCard';
import { WorkTypeExportCard } from './interop/cards/WorkTypeExportCard';
import { useInteropArchiveMaintenance } from './interop/hooks/useInteropArchiveMaintenance';
import { useInteropKpiExport } from './interop/hooks/useInteropKpiExport';
import { useInteropWorkPackageImport } from './interop/hooks/useInteropWorkPackageImport';
import { useInteropWorkTypeInterop } from './interop/hooks/useInteropWorkTypeInterop';

interface SettingsInteropViewProps {
  onBack: () => void;
}

export function SettingsInteropView({ onBack }: SettingsInteropViewProps) {
  const { tasks } = useTaskStore();
  const { templates } = useTemplateStore();
  const { workTypes } = useWorkTypeStore();

  const workTypeTitleById = useMemo(
    () => new Map(workTypes.map((workType) => [workType.id, workType.title])),
    [workTypes],
  );

  const workPackageImport = useInteropWorkPackageImport({
    tasks,
    templates,
    workTypeTitleById,
  });

  const kpiExport = useInteropKpiExport({
    tasks,
    workTypes,
    onSummary: workPackageImport.setApplySummary,
  });

  const workTypeInterop = useInteropWorkTypeInterop({
    workTypes,
  });

  const archiveMaintenance = useInteropArchiveMaintenance({
    onSummary: workPackageImport.setApplySummary,
  });

  return (
    <SettingsDetailLayout title="Interop" onBack={onBack}>
      <KpiExportCard
        exportProfile={kpiExport.exportProfile}
        isExporting={kpiExport.isExporting}
        onExport={() => {
          void kpiExport.handleExport();
        }}
        onExportProfileChange={kpiExport.setExportProfile}
      />

      <WorkTypeExportCard
        isExporting={workTypeInterop.isExportingWorkTypes}
        onExport={workTypeInterop.handleWorkTypeExport}
        summaryMessage={workTypeInterop.workTypeExportSummary}
      />

      <WorkPackageImportCard
        csvInput={workPackageImport.csvInput}
        onCsvInputChange={workPackageImport.setCsvInput}
        onParse={workPackageImport.handleParse}
        parseErrors={workPackageImport.parseErrors}
        preview={workPackageImport.preview}
        isApplying={workPackageImport.isApplying}
        importApplyGateOpen={workPackageImport.importApplyGateOpen}
        onApply={() => {
          void workPackageImport.handleApply();
        }}
        applySummary={workPackageImport.applySummary}
      />

      <WorkTypeImportCard
        summaryMessage={workTypeInterop.workTypeImportSummary}
        csvInput={workTypeInterop.workTypeCsvInput}
        onCsvInputChange={workTypeInterop.setWorkTypeCsvInput}
        onParse={workTypeInterop.handleParseWorkTypeImport}
        parseErrors={workTypeInterop.workTypeParseErrors}
        preview={workTypeInterop.workTypePreview}
        isApplying={workTypeInterop.isApplyingWorkTypeImport}
        onApply={() => {
          void workTypeInterop.handleApplyWorkTypeImport();
        }}
      />

      {archiveMaintenance.archiveToolsEnabled && (
        <ArchiveMaintenanceCard
          maintenanceReport={archiveMaintenance.maintenanceReport}
          isRunningMaintenance={archiveMaintenance.isRunningMaintenance}
          onRunMaintenance={() => {
            void archiveMaintenance.handleRunMaintenance();
          }}
          archiveGroups={archiveMaintenance.archiveGroups}
          recomputeReport={archiveMaintenance.recomputeReport}
          isRecomputingArchive={archiveMaintenance.isRecomputingArchive}
          archiveRecomputeGateOpen={archiveMaintenance.archiveRecomputeGateOpen}
          onRecomputeArchivedKpis={() => {
            void archiveMaintenance.handleRecomputeArchivedKpis();
          }}
        />
      )}
    </SettingsDetailLayout>
  );
}

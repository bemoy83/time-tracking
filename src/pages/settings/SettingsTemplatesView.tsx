import { useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { useTemplateStore, deleteTemplate } from '../../lib/stores/template-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import type { TaskTemplate } from '../../lib/types';
import { BUILD_PHASE_LABELS, formatWorkTypeWithUnit, resolveWorkUnitLabel } from '../../lib/types';
import { TemplateFormSheet } from '../../components/TemplateFormSheet';
import { DeleteTemplateConfirm } from '../../components/DeleteTemplateConfirm';
import { ExportIcon, PencilIcon, TrashIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { exportTemplatesCsv } from '../../lib/interop/template-export';
import { downloadCsv } from '../../lib/interop/download-csv';
import { WorkPackageImportCard } from './cards/WorkPackageImportCard';
import { useTemplateImport } from './hooks/useTemplateImport';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';
import './settings-styles';

interface SettingsTemplatesViewProps {
  onBack: () => void;
}

export function SettingsTemplatesView({ onBack }: SettingsTemplatesViewProps) {
  const { tasks } = useTaskStore();
  const { templates } = useTemplateStore();
  const { workTypes } = useWorkTypeStore();
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TaskTemplate | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<string | null>(null);

  const workTypeById = useMemo(
    () => new Map(workTypes.map((workType) => [workType.id, workType])),
    [workTypes],
  );

  const workTypeTitleById = useMemo(
    () => new Map(workTypes.map((workType) => [workType.id, workType.title])),
    [workTypes],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateImport = useTemplateImport({
    tasks,
    templates,
    workTypeTitleById,
  });
  const {
    preview: workUnitPreview,
    applyImportedLabels: applyImportedUnitLabels,
    setApplyImportedLabels: setApplyImportedUnitLabels,
  } = useWorkUnitImportPreview(
    templateImport.preview?.items.map(({ item }) => ({
      id: item.workUnit,
      label: item.workUnitLabel,
    })) ?? null,
    workUnitDefinitions,
  );

  const handleEditTemplate = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setShowTemplateForm(true);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateForm(true);
  };

  const handleCloseTemplateForm = () => {
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    await deleteTemplate(deletingTemplate.id);
    setDeletingTemplate(null);
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  const handleExportTemplates = () => {
    setIsExporting(true);
    try {
      const csv = exportTemplatesCsv(templates, workTypeTitleById);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`templates-${stamp}.csv`, csv);
      setExportSummary(`Exported ${templates.length} template definitions.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SettingsDetailLayout title="Templates" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Templates</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--circle"
            onClick={handleAddTemplate}
          >
            +
          </button>
        </div>
        <p className="settings-view__helper">Create reusable presets for faster task creation</p>

        {templates.length === 0 ? (
          <div className="empty-state">
            <PencilIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No templates yet</p>
            <p className="empty-state__text">Add one to speed up task creation.</p>
          </div>
        ) : (
          <div className="settings-view__list">
            {templates.map((template) => (
              <div key={template.id} className="settings-view__list-item">
                <button
                  className="settings-view__row"
                  onClick={() => handleEditTemplate(template)}
                >
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">{template.title}</span>
                    <span className="settings-view__row-detail">
                      {(() => {
                        const workType = template.workTypeId
                          ? workTypeById.get(template.workTypeId)
                          : null;
                        return workType
                          ? formatWorkTypeWithUnit(workType.title, workType.workUnit)
                          : `${BUILD_PHASE_LABELS[template.phase]} · ${resolveWorkUnitLabel(template.workUnit)}`;
                      })()}
                    </span>
                  </div>
                </button>
                <div className="settings-view__list-item-actions">
                  <IconButton
                    icon={<PencilIcon className="settings-detail__icon" />}
                    ariaLabel={`Edit template ${template.title}`}
                    onClick={() => handleEditTemplate(template)}
                    variant="ghost"
                    className="icon-btn--edit"
                  />
                  <IconButton
                    icon={<TrashIcon className="settings-detail__icon" />}
                    ariaLabel={`Delete template ${template.title}`}
                    onClick={() => setDeletingTemplate(template)}
                    variant="ghost"
                    className="icon-btn--danger"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Templates</h2>
          <IconButton
            icon={<ExportIcon className="settings-view__export-icon" />}
            ariaLabel={isExporting ? 'Exporting...' : 'Export templates'}
            onClick={handleExportTemplates}
            disabled={isExporting}
          />
        </div>
        <p className="settings-view__helper">Export template definitions as CSV.</p>
        {exportSummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {exportSummary}
          </p>
        )}
      </div>

      <WorkPackageImportCard
        title="Import Templates"
        fileInputRef={fileInputRef}
        onFileChange={templateImport.handleFileChange}
        preview={templateImport.preview}
        isLoadingPreview={templateImport.isLoadingPreview}
        isApplying={templateImport.isApplying}
        importApplyGateOpen={templateImport.importApplyGateOpen}
        onApply={() => {
          void templateImport.handleApply(applyImportedUnitLabels);
        }}
        applySummary={templateImport.applySummary}
        workUnitPreview={workUnitPreview}
        applyImportedUnitLabels={applyImportedUnitLabels}
        onToggleApplyImportedUnitLabels={setApplyImportedUnitLabels}
      />

      <TemplateFormSheet
        isOpen={showTemplateForm}
        onClose={handleCloseTemplateForm}
        template={editingTemplate}
        onDelete={editingTemplate ? () => setDeletingTemplate(editingTemplate) : undefined}
      />

      <DeleteTemplateConfirm
        isOpen={!!deletingTemplate}
        templateTitle={deletingTemplate?.title ?? ''}
        onConfirm={handleDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
      />
    </SettingsDetailLayout>
  );
}

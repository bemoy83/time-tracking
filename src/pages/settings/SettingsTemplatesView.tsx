import { useMemo, useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { useTemplateStore, deleteTemplate } from '../../lib/stores/template-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import type { TaskTemplate } from '../../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../../lib/types';
import { TemplateFormSheet } from '../../components/TemplateFormSheet';
import { DeleteTemplateConfirm } from '../../components/DeleteTemplateConfirm';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { exportTemplatesCsv } from '../../lib/interop/template-export';
import { downloadCsv } from '../../lib/interop/download-csv';
import { WorkPackageImportCard } from './cards/WorkPackageImportCard';
import { useTemplateImport } from './hooks/useTemplateImport';

interface SettingsTemplatesViewProps {
  onBack: () => void;
}

export function SettingsTemplatesView({ onBack }: SettingsTemplatesViewProps) {
  const { tasks } = useTaskStore();
  const { templates } = useTemplateStore();
  const { workTypes } = useWorkTypeStore();
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

  const templateImport = useTemplateImport({
    tasks,
    templates,
    workTypeTitleById,
  });

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
            className="btn btn--primary btn--sm"
            onClick={handleAddTemplate}
          >
            + Add
          </button>
        </div>
        <p className="settings-view__helper">Create reusable presets for faster task creation</p>

        {templates.length === 0 ? (
          <p className="settings-view__empty">No templates yet. Add one to speed up task creation.</p>
        ) : (
          <div className="settings-view__list">
            {templates.map((template) => (
              <button
                key={template.id}
                className="settings-view__row"
                onClick={() => handleEditTemplate(template)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{template.title}</span>
                  <span className="settings-view__row-detail">
                    {(() => {
                      const workType = template.workTypeId ? workTypeById.get(template.workTypeId) : null;
                      return workType
                        ? `${workType.title} · ${BUILD_PHASE_LABELS[workType.buildPhase]} · ${WORK_UNIT_LABELS[workType.workUnit]}`
                        : `${BUILD_PHASE_LABELS[template.buildPhase]} · ${WORK_UNIT_LABELS[template.workUnit]}`;
                    })()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Templates</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleExportTemplates}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
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
        csvInput={templateImport.csvInput}
        onCsvInputChange={templateImport.setCsvInput}
        onParse={templateImport.handleParse}
        parseErrors={templateImport.parseErrors}
        preview={templateImport.preview}
        isApplying={templateImport.isApplying}
        importApplyGateOpen={templateImport.importApplyGateOpen}
        onApply={() => {
          void templateImport.handleApply();
        }}
        applySummary={templateImport.applySummary}
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

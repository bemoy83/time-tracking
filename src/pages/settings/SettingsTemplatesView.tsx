import { useState } from 'react';
import { useTemplateStore, deleteTemplate } from '../../lib/stores/template-store';
import { getWorkTypeById } from '../../lib/stores/work-type-store';
import type { TaskTemplate } from '../../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../../lib/types';
import { TemplateFormSheet } from '../../components/TemplateFormSheet';
import { DeleteTemplateConfirm } from '../../components/DeleteTemplateConfirm';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsTemplatesViewProps {
  onBack: () => void;
}

export function SettingsTemplatesView({ onBack }: SettingsTemplatesViewProps) {
  const { templates } = useTemplateStore();
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TaskTemplate | null>(null);

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
            {templates.map((t) => (
              <button
                key={t.id}
                className="settings-view__row"
                onClick={() => handleEditTemplate(t)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{t.title}</span>
                  <span className="settings-view__row-detail">
                    {(() => {
                      const wt = t.workTypeId ? getWorkTypeById(t.workTypeId) : null;
                      return wt
                        ? `${wt.title} · ${BUILD_PHASE_LABELS[wt.buildPhase]} · ${WORK_UNIT_LABELS[wt.workUnit]}`
                        : `${BUILD_PHASE_LABELS[t.buildPhase]} · ${WORK_UNIT_LABELS[t.workUnit]}`;
                    })()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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

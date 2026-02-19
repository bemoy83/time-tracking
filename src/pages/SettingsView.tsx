import { useState, useEffect } from 'react';
import { useTaskStore } from '../lib/stores/task-store';
import { useTemplateStore } from '../lib/stores/template-store';
import { deleteTemplate } from '../lib/stores/template-store';
import { purgeTimeEntries, resetAllData } from '../lib/stores/purge-store';
import { getParallelSubtaskTimers, setParallelSubtaskTimers } from '../lib/stores/timer-store';
import { getAllTimeEntries } from '../lib/db';
import {
  TaskTemplate,
  WORK_UNIT_LABELS,
  WORK_CATEGORY_LABELS,
  BUILD_PHASE_LABELS,
} from '../lib/types';
import { PurgeEntriesConfirm } from '../components/PurgeEntriesConfirm';
import { PurgeResetConfirm } from '../components/PurgeResetConfirm';
import { TemplateFormSheet } from '../components/TemplateFormSheet';
import { DeleteTemplateConfirm } from '../components/DeleteTemplateConfirm';
import { KpiSection } from '../components/KpiSection';
import { pluralize } from '../lib/utils/pluralize';

export function SettingsView() {
  const { tasks, projects } = useTaskStore();
  const { templates } = useTemplateStore();
  const [entryCount, setEntryCount] = useState(0);
  const [showPurgeEntries, setShowPurgeEntries] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [parallelTimers, setParallelTimers] = useState(getParallelSubtaskTimers);

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    getAllTimeEntries().then((entries) => setEntryCount(entries.length));
  }, []);

  const handlePurgeEntries = async () => {
    await purgeTimeEntries();
    setEntryCount(0);
    setShowPurgeEntries(false);
  };

  const handleResetAll = async () => {
    await resetAllData();
    setEntryCount(0);
    setShowResetAll(false);
  };

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
    <div className="settings-view">
      <section className="settings-view__section">
        <h2 className="settings-view__section-title section-heading">Timers</h2>

        <label className="settings-view__row settings-view__row--toggle">
          <div className="settings-view__toggle-text">
            <span className="settings-view__row-label">Parallel subtask timers</span>
            <span className="settings-view__row-detail">
              Allow multiple subtasks to run timers simultaneously
            </span>
          </div>
          <input
            type="checkbox"
            className="settings-view__toggle"
            checked={parallelTimers}
            onChange={(e) => {
              setParallelTimers(e.target.checked);
              setParallelSubtaskTimers(e.target.checked);
            }}
          />
        </label>
      </section>

      <section className="settings-view__section">
        <div className="settings-view__section-header">
          <h2 className="settings-view__section-title section-heading">Templates</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleAddTemplate}
          >
            + Add
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="settings-view__empty">No templates yet. Add one to speed up task creation.</p>
        ) : (
          <div className="settings-view__template-list">
            {templates.map((t) => (
              <button
                key={t.id}
                className="settings-view__row"
                onClick={() => handleEditTemplate(t)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{t.title}</span>
                  <span className="settings-view__row-detail">
                    {WORK_CATEGORY_LABELS[t.workCategory]} · {BUILD_PHASE_LABELS[t.buildPhase]} · {WORK_UNIT_LABELS[t.workUnit]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title section-heading">Productivity</h2>
        <KpiSection tasks={tasks} />
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title section-heading">Data</h2>

        <button
          className="settings-view__row settings-view__row--danger"
          onClick={() => setShowPurgeEntries(true)}
          disabled={entryCount === 0}
        >
          <span className="settings-view__row-label">Clear time entries</span>
          <span className="settings-view__row-detail">
            {entryCount === 0
              ? 'No time entries'
              : pluralize(entryCount, 'entry', 'entries')}
          </span>
        </button>

        <button
          className="settings-view__row settings-view__row--danger"
          onClick={() => setShowResetAll(true)}
        >
          <span className="settings-view__row-label">Reset all data</span>
          <span className="settings-view__row-detail">
            Tasks, projects, and time entries
          </span>
        </button>
      </section>

      <PurgeEntriesConfirm
        isOpen={showPurgeEntries}
        entryCount={entryCount}
        onConfirm={handlePurgeEntries}
        onCancel={() => setShowPurgeEntries(false)}
      />
      <PurgeResetConfirm
        isOpen={showResetAll}
        taskCount={tasks.length}
        projectCount={projects.length}
        entryCount={entryCount}
        onConfirm={handleResetAll}
        onCancel={() => setShowResetAll(false)}
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
    </div>
  );
}

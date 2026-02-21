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
import { AttributionQualitySection } from '../components/AttributionQualitySection';
import { recomputeAttribution } from '../lib/attribution/cache';
import { CalculatorSheet } from '../components/CalculatorSheet';
import { pluralize } from '../lib/utils/pluralize';
import { getAttributionPolicy, setAttributionPolicy } from '../lib/stores/attribution-settings';
import type { AttributionPolicy } from '../lib/types';

export function SettingsView() {
  const { tasks, projects } = useTaskStore();
  const { templates } = useTemplateStore();
  const [entryCount, setEntryCount] = useState(0);
  const [showPurgeEntries, setShowPurgeEntries] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [parallelTimers, setParallelTimers] = useState(getParallelSubtaskTimers);

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);

  // Attribution refresh key — bumped by Recompute to trigger re-render
  const [attributionKey, setAttributionKey] = useState(0);

  // Attribution policy
  const [policy, setPolicy] = useState<AttributionPolicy>(getAttributionPolicy);

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
      <h1 className="settings-view__title">Settings</h1>

      {/* Timers */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
            <h2 className="settings-view__section-title section-heading">Timers</h2>
          </div>

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
        </div>
      </section>

      {/* Templates */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
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
        </div>
      </section>

      {/* Productivity */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
            <h2 className="settings-view__section-title section-heading">Productivity</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setShowCalculator(true)}
            >
              Calculator
            </button>
          </div>
          <KpiSection tasks={tasks} />
        </div>
      </section>

      {/* Attribution Quality */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
            <h2 className="settings-view__section-title section-heading">Attribution Quality</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={async () => {
                await recomputeAttribution();
                setAttributionKey((k) => k + 1);
              }}
            >
              Recompute
            </button>
          </div>
          <label className="settings-view__row">
            <span className="settings-view__row-label">Policy</span>
            <select
              className="input"
              value={policy}
              onChange={(e) => {
                const next = e.target.value as AttributionPolicy;
                setPolicy(next);
                setAttributionPolicy(next);
                setAttributionKey((k) => k + 1);
              }}
            >
              <option value="soft_allow_flag">Suggest only (default)</option>
              <option value="strict_block">Strict block</option>
              <option value="soft_allow_pick_nearest">Auto-apply nearest</option>
            </select>
          </label>
          <AttributionQualitySection key={attributionKey} tasks={tasks} policy={policy} />
        </div>
      </section>

      {/* Data */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
            <h2 className="settings-view__section-title section-heading">Data</h2>
          </div>

          <button
            className="settings-view__danger-link"
            onClick={() => setShowPurgeEntries(true)}
            disabled={entryCount === 0}
          >
            Clear time entries
            {entryCount > 0 && (
              <span className="settings-view__danger-meta">
                ({pluralize(entryCount, 'entry', 'entries')})
              </span>
            )}
          </button>

          <button
            className="settings-view__danger-link"
            onClick={() => setShowResetAll(true)}
          >
            Reset all data
          </button>
        </div>
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

      <CalculatorSheet
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        tasks={tasks}
      />
    </div>
  );
}

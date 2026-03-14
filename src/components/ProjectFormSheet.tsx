import { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectPhaseDates } from '../lib/types';
import {
  createProject,
  updateProjectName,
  updateProjectPhaseDates,
} from '../lib/stores/task-store';
import {
  getProjectPhaseDateValidationErrors,
  normalizeProjectPhaseDates,
} from '../lib/projects/project-phase-dates';
import { ActionSheet } from './ActionSheet';

interface ProjectFormSheetProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onSaved?: () => void;
  onDelete?: () => void;
}

function buildInitialDates(project: Project | null): ProjectPhaseDates {
  return normalizeProjectPhaseDates(project);
}

export function ProjectFormSheet({
  isOpen,
  project,
  onClose,
  onSaved,
  onDelete,
}: ProjectFormSheetProps) {
  const isEdit = project != null;
  const [name, setName] = useState('');
  const [phaseDates, setPhaseDates] = useState<ProjectPhaseDates>(buildInitialDates(project));
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(project?.name ?? '');
    setPhaseDates(buildInitialDates(project));
    setSubmitError(null);
    setIsSaving(false);
  }, [isOpen, project]);

  const validationErrors = useMemo(
    () => getProjectPhaseDateValidationErrors(phaseDates),
    [phaseDates],
  );
  const canSave = name.trim().length > 0 && validationErrors.length === 0 && !isSaving;

  const updateDate = (field: keyof ProjectPhaseDates, value: string) => {
    setPhaseDates((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSubmitError(null);
    try {
      if (project) {
        await updateProjectName(project.id, name.trim());
        await updateProjectPhaseDates(project.id, phaseDates);
      } else {
        await createProject(name.trim(), { phaseDates });
      }
      onSaved?.();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ActionSheet isOpen={isOpen} title={isEdit ? 'Edit Project' : 'New Project'} onClose={onClose}>
      <div className="create-task-sheet__form">
        {submitError && (
          <div className="calculator__provenance-warning" style={{ padding: '8px 0', color: 'var(--color-danger, #dc2626)' }}>
            {submitError}
          </div>
        )}

        <input
          type="text"
          className="input"
          placeholder="Project name..."
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Assembly</label>
          <div className="planning-view__wp-add-bar-fields">
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">From</span>
              <input
                type="date"
                className="input"
                value={phaseDates.assemblyStartDate ?? ''}
                onChange={(event) => updateDate('assemblyStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">To</span>
              <input
                type="date"
                className="input"
                value={phaseDates.assemblyEndDate ?? ''}
                onChange={(event) => updateDate('assemblyEndDate', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Dismantle</label>
          <div className="planning-view__wp-add-bar-fields">
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">From</span>
              <input
                type="date"
                className="input"
                value={phaseDates.dismantleStartDate ?? ''}
                onChange={(event) => updateDate('dismantleStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">To</span>
              <input
                type="date"
                className="input"
                value={phaseDates.dismantleEndDate ?? ''}
                onChange={(event) => updateDate('dismantleEndDate', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Event</label>
          <div className="planning-view__wp-add-bar-fields">
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">From</span>
              <input
                type="date"
                className="input"
                value={phaseDates.eventStartDate ?? ''}
                onChange={(event) => updateDate('eventStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__wp-add-bar-field">
              <span className="planning-view__wp-add-bar-label">To</span>
              <input
                type="date"
                className="input"
                value={phaseDates.eventEndDate ?? ''}
                onChange={(event) => updateDate('eventEndDate', event.target.value)}
              />
            </label>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="calculator__provenance-warning" style={{ padding: '8px 0', color: 'var(--color-danger, #dc2626)' }}>
            {validationErrors.join(' ')}
          </div>
        )}

        <div className="action-sheet__actions">
          {isEdit && onDelete && (
            <button type="button" className="btn btn--danger btn--lg" onClick={onDelete}>
              Delete
            </button>
          )}
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}

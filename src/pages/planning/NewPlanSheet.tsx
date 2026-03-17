/**
 * NewPlanSheet — Create a new plan.
 *
 * - variant="sheet": iOS-style bottom action sheet (mobile)
 * - variant="modal": centered dialog (desktop workspace)
 *
 * - Segmented control: [Project] [Standalone]
 * - Project mode: searchable project list + inline create
 * - Standalone mode: name input
 */

import { useState, useEffect, useRef } from 'react';
import { ActionSheet } from '../../components/ActionSheet';
import { useModalFocusTrap } from '../../lib/hooks/useModalFocusTrap';
import { createProject } from '../../lib/stores/task-store';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { InlineCreateForm } from '../../components/InlineCreateForm';
import { PlusIcon, XIcon } from '../../components/icons';
import type { Project } from '../../lib/types';

export interface NewPlanInit {
  title?: string;
  projectId?: string | null;
}

interface NewPlanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onConfirm: (init: NewPlanInit) => void;
  variant?: 'sheet' | 'modal';
}

type Mode = 'project' | 'standalone';

export function NewPlanSheet({
  isOpen,
  onClose,
  projects,
  onConfirm,
  variant = 'sheet',
}: NewPlanSheetProps) {
  const [mode, setMode] = useState<Mode>('project');
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [standaloneName, setStandaloneName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const createProjectInputRef = useRef<HTMLInputElement>(null);
  const standaloneInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useModalFocusTrap(
    isOpen && variant === 'modal',
    onClose,
    variant === 'modal' ? searchInputRef : undefined
  );

  useEffect(() => {
    if (isOpen) {
      setMode('project');
      setSearch('');
      setSelectedProjectId(null);
      setStandaloneName('');
      setShowCreateForm(false);
      setNewProjectName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === 'standalone') {
      standaloneInputRef.current?.focus();
    }
  }, [mode]);

  useEffect(() => {
    if (showCreateForm) {
      createProjectInputRef.current?.focus();
    }
  }, [showCreateForm]);

  const filteredProjects = search.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const canCreate =
    mode === 'project' ? selectedProjectId !== null : standaloneName.trim().length > 0;

  const handleConfirm = () => {
    if (!canCreate) return;
    if (mode === 'project') {
      onConfirm({ projectId: selectedProjectId });
    } else {
      onConfirm({ title: standaloneName.trim() });
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject(newProjectName.trim());
    setSelectedProjectId(project.id);
    setShowCreateForm(false);
    setNewProjectName('');
  };

  const handleProjectListKeyDown = (e: React.KeyboardEvent) => {
    if (filteredProjects.length === 0) return;
    const idx = selectedProjectId
      ? filteredProjects.findIndex((p) => p.id === selectedProjectId)
      : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = idx < filteredProjects.length - 1 ? idx + 1 : 0;
      setSelectedProjectId(filteredProjects[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : filteredProjects.length - 1;
      setSelectedProjectId(filteredProjects[prev].id);
    } else if (e.key === 'Enter' && canCreate) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (filteredProjects.length === 0) return;
    e.preventDefault();
    projectListRef.current?.focus();
    if (!selectedProjectId) {
      setSelectedProjectId(
        e.key === 'ArrowDown'
          ? filteredProjects[0].id
          : filteredProjects[filteredProjects.length - 1].id
      );
    }
  };

  useEffect(() => {
    if (selectedProjectId && projectListRef.current) {
      const el = projectListRef.current.querySelector(
        `[data-project-id="${selectedProjectId}"]`
      );
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedProjectId]);

  const body = (
    <>
      {/* Segmented control */}
      <div
        className="task-work-quantity__unit-pills new-plan-sheet__segments"
        role="group"
        aria-label="Plan type"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'project'}
          className={`task-work-quantity__unit-pill${mode === 'project' ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => setMode('project')}
        >
          Project
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'standalone'}
          className={`task-work-quantity__unit-pill${mode === 'standalone' ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => setMode('standalone')}
        >
          Standalone
        </button>
      </div>

      {mode === 'project' ? (
        <div className="new-plan-sheet__pane">
          <p className="new-plan-sheet__helper">
            Link to a project to pre-fill event dates and group all delivery tasks together.
          </p>
          <input
            ref={searchInputRef}
            className="input new-plan-sheet__search"
            type="search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search projects"
          />
          <div
            ref={projectListRef}
            className="new-plan-sheet__project-list"
            role="listbox"
            tabIndex={filteredProjects.length > 0 ? 0 : -1}
            aria-label="Projects"
            aria-activedescendant={
              selectedProjectId ? `project-option-${selectedProjectId}` : undefined
            }
            onKeyDown={handleProjectListKeyDown}
          >
            {filteredProjects.length === 0 ? (
              <p className="new-plan-sheet__empty">
                {search.trim() ? 'No projects match your search.' : 'No projects yet.'}
              </p>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  id={`project-option-${project.id}`}
                  type="button"
                  role="option"
                  aria-selected={selectedProjectId === project.id}
                  data-project-id={project.id}
                  tabIndex={-1}
                  className={`new-plan-sheet__project-option${selectedProjectId === project.id ? ' new-plan-sheet__project-option--selected' : ''}`}
                  onClick={() => setSelectedProjectId(project.id)}
                  onKeyDown={(e) => {
                    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
                      e.preventDefault();
                      handleProjectListKeyDown(e);
                      if (e.key !== 'Enter') projectListRef.current?.focus();
                    }
                  }}
                >
                  <ProjectColorDot color={project.color} />
                  <span className="new-plan-sheet__project-name">{project.name}</span>
                </button>
              ))
            )}
          </div>
          {showCreateForm ? (
            <InlineCreateForm
              className="new-plan-sheet__create-form"
              placeholder="Project name…"
              submitLabel="Add"
              value={newProjectName}
              onChange={setNewProjectName}
              onSubmit={handleCreateProject}
              inputRef={createProjectInputRef}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="new-plan-sheet__add-project-btn"
              onClick={() => setShowCreateForm(true)}
            >
              <PlusIcon className="new-plan-sheet__add-project-icon" />
              Create project
            </button>
          )}
        </div>
      ) : (
        <div className="new-plan-sheet__pane">
          <p className="new-plan-sheet__helper">
            Name this plan independently. Great for one-off events that don't belong to an active project.
          </p>
          <input
            ref={standaloneInputRef}
            className="input new-plan-sheet__name-input"
            placeholder="Plan name…"
            value={standaloneName}
            onChange={(e) => setStandaloneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) handleConfirm();
            }}
            aria-label="Plan name"
          />
        </div>
      )}

      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={!canCreate}
            onClick={handleConfirm}
          >
            Create Plan
          </button>
        </div>
      </div>
    </>
  );

  if (variant === 'modal') {
    if (!isOpen) return null;
    return (
      <div className="new-plan-modal-backdrop" onClick={onClose} aria-hidden="true">
        <div
          ref={modalRef}
          className="new-plan-modal"
          role="dialog"
          aria-modal="true"
          aria-label="New Plan"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="new-plan-modal__header">
            <h2 className="new-plan-modal__title">New Plan</h2>
            <button
              className="new-plan-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon className="new-plan-modal__close-icon" />
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <ActionSheet isOpen={isOpen} title="New Plan" onClose={onClose}>
      {body}
    </ActionSheet>
  );
}

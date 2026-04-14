/**
 * ProjectPicker component.
 * Modal for selecting or creating a project.
 * Used from TaskDetail and PlanEditor.
 *
 * Renders via createPortal into document.body so the overlay is not clipped or
 * re-contained by ancestor transform / overflow (same pattern as TagPickerModal).
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore, createProject } from '../lib/stores/task-store';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { PlusIcon, XIcon } from './icons';
import { ProjectColorDot } from './ProjectColorDot';
import { InlineCreateForm } from './InlineCreateForm';

interface ProjectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (projectId: string | null) => void;
  currentProjectId: string | null;
  currentTitle?: string;
  onSetTitle?: (title: string) => void;
}

export function ProjectPicker({
  isOpen,
  onClose,
  onSelect,
  currentProjectId,
  currentTitle,
  onSetTitle,
}: ProjectPickerProps) {
  const { projects } = useTaskStore();
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [standaloneTitle, setStandaloneTitle] = useState('');
  const dialogRef = useModalFocusTrap(isOpen, onClose);
  const createInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  // Focus create input when shown
  useEffect(() => {
    if (showCreateInput) {
      createInputRef.current?.focus();
    }
  }, [showCreateInput]);

  // Sync standalone title when opened
  useEffect(() => {
    if (isOpen) {
      setStandaloneTitle(currentTitle ?? '');
    }
  }, [isOpen, currentTitle]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setShowCreateInput(false);
      setNewName('');
      setSearch('');
    }
  }, [isOpen]);

  const filteredProjects = search.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  if (!isOpen) return null;

  const handleSelectNone = () => {
    onSelect(null);
    onClose();
  };

  const handleSelectProject = (projectId: string) => {
    onSelect(projectId);
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const project = await createProject(newName.trim());
    onSelect(project.id);
    onClose();
  };

  return createPortal(
    <div
      className="new-plan-modal-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className="new-plan-modal project-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Link to project"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="new-plan-modal__header">
          <h2 className="new-plan-modal__title">Name This Plan</h2>
          <button
            type="button"
            className="new-plan-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="new-plan-modal__close-icon" />
          </button>
        </div>

        <div className="project-picker-modal__body">
          <div className="new-plan-sheet__pane">
            <input
              ref={searchInputRef}
              className="input new-plan-sheet__search"
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search projects"
            />

            <div className="new-plan-sheet__project-list">
              {filteredProjects.length === 0 ? (
                <p className="new-plan-sheet__empty">
                  {search.trim() ? 'No projects match your search.' : 'No projects yet.'}
                </p>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`new-plan-sheet__project-option${
                      currentProjectId === project.id
                        ? ' new-plan-sheet__project-option--selected'
                        : ''
                    }`}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    <ProjectColorDot color={project.color} />
                    <span className="new-plan-sheet__project-name">{project.name}</span>
                  </button>
                ))
              )}
            </div>

            {showCreateInput ? (
              <InlineCreateForm
                className="new-plan-sheet__create-form"
                placeholder="Project name…"
                submitLabel="Add"
                value={newName}
                onChange={setNewName}
                onSubmit={handleCreate}
                inputRef={createInputRef}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="new-plan-sheet__add-project-btn"
                onClick={() => setShowCreateInput(true)}
              >
                <PlusIcon className="new-plan-sheet__add-project-icon" />
                Create project
              </button>
            )}
          </div>

          {onSetTitle && !search.trim() && (
            <>
              <hr className="project-picker-modal__divider" />
              <div className="project-picker-modal__standalone">
                <span className="project-picker-modal__standalone-label">or name this event</span>
                <div className="project-picker-modal__standalone-row">
                  <input
                    className="input project-picker-modal__standalone-input"
                    placeholder="Event name…"
                    value={standaloneTitle}
                    onChange={(e) => setStandaloneTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && standaloneTitle.trim()) {
                        onSetTitle(standaloneTitle.trim());
                        onClose();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn project-picker-modal__standalone-btn"
                    disabled={!standaloneTitle.trim()}
                    onClick={() => {
                      if (standaloneTitle.trim()) {
                        onSetTitle(standaloneTitle.trim());
                        onClose();
                      }
                    }}
                  >
                    Set
                  </button>
                </div>
              </div>
            </>
          )}

          {currentProjectId !== null && !search.trim() && (
            <>
              <hr className="project-picker-modal__divider" />
              <button
                type="button"
                className="new-plan-sheet__project-option project-picker-modal__unlink"
                onClick={handleSelectNone}
              >
                Remove project link
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

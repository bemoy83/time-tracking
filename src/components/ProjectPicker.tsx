/**
 * ProjectPicker component.
 * Modal for selecting or creating a project.
 * Used from TaskDetail to assign tasks to projects.
 */

import { useState, useEffect, useRef } from 'react';
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
}

export function ProjectPicker({
  isOpen,
  onClose,
  onSelect,
  currentProjectId,
}: ProjectPickerProps) {
  const { projects } = useTaskStore();
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
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

  return (
    <div
      className="project-picker-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className="project-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Link to project"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-picker__header">
          <h2 className="project-picker__title">Link to Project</h2>
          <button
            className="project-picker__close"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="project-picker__close-icon" />
          </button>
        </div>

        <input
          ref={searchInputRef}
          className="input project-picker__search"
          type="search"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search projects"
        />

        <div className="project-picker__list">
          {/* Existing projects */}
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              className={`project-picker__option ${
                currentProjectId === project.id
                  ? 'project-picker__option--selected'
                  : ''
              }`}
              onClick={() => handleSelectProject(project.id)}
            >
              <ProjectColorDot color={project.color} />
              <span className="project-picker__option-name">{project.name}</span>
            </button>
          ))}
        </div>

        {/* Create new project */}
        {showCreateInput ? (
          <InlineCreateForm
            className="project-picker__create-form"
            placeholder="Project name..."
            submitLabel="Add"
            value={newName}
            onChange={setNewName}
            onSubmit={handleCreate}
            inputRef={createInputRef}
            autoFocus
          />
        ) : (
          <button
            className="project-picker__add-btn"
            onClick={() => setShowCreateInput(true)}
          >
            <PlusIcon className="project-picker__icon" />
            Create project
          </button>
        )}

        {/* None / unlink option — separated at bottom, hidden during search */}
        {currentProjectId !== null && !search.trim() && (
          <>
            <hr className="project-picker__divider" />
            <button
              className="project-picker__option project-picker__option--none"
              onClick={handleSelectNone}
            >
              Remove project link
            </button>
          </>
        )}
      </div>
    </div>
  );
}

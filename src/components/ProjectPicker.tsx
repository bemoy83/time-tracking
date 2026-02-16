/**
 * ProjectPicker component.
 * Modal for selecting or creating a project.
 * Used from TaskDetail to assign tasks to projects.
 */

import { useState, useEffect, useRef } from 'react';
import { useTaskStore, createProject } from '../lib/stores/task-store';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { PlusIcon } from './icons';
import { ProjectColorDot } from './ProjectColorDot';

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
  const dialogRef = useModalFocusTrap(isOpen, onClose);
  const createInputRef = useRef<HTMLInputElement>(null);

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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectNone = () => {
    onSelect(null);
    onClose();
  };

  const handleSelectProject = (projectId: string) => {
    onSelect(projectId);
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        aria-label="Select project"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="project-picker__title">Project</h2>

        <div className="project-picker__list">
          {/* None option */}
          <button
            className={`project-picker__option ${
              currentProjectId === null ? 'project-picker__option--selected' : ''
            }`}
            onClick={handleSelectNone}
          >
            None
          </button>

          {/* Existing projects */}
          {projects.map((project) => (
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
              {project.name}
            </button>
          ))}
        </div>

        {/* Create new project */}
        {showCreateInput ? (
          <form className="project-picker__create-form" onSubmit={handleCreate}>
            <input
              ref={createInputRef}
              type="text"
              placeholder="Project name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input"
            />
            <button
              type="submit"
              className="project-picker__create-btn"
              disabled={!newName.trim()}
            >
              Add
            </button>
          </form>
        ) : (
          <button
            className="project-picker__add-btn"
            onClick={() => setShowCreateInput(true)}
          >
            <PlusIcon className="project-picker__icon" />
            Create project
          </button>
        )}
      </div>
    </div>
  );
}


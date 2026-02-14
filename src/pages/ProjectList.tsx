/**
 * ProjectList page.
 * Lists all projects with color chips. Allows creating new projects with name + color.
 */

import { useState } from 'react';
import { Project, PROJECT_COLORS } from '../lib/types';
import { useTaskStore, createProject } from '../lib/stores/task-store';
import { PlusIcon, ChevronIcon } from '../components/icons';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const { projects, tasks } = useTaskStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createProject(newName.trim(), selectedColor);
    setNewName('');
    setSelectedColor(PROJECT_COLORS[0]);
    setShowCreateForm(false);
  };

  const getTaskCount = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.parentId === null).length;

  return (
    <div className="project-list">
      <header className="project-list__header">
        <h1 className="project-list__title">Projects</h1>
        {!showCreateForm && (
          <button
            className="project-list__add-btn"
            onClick={() => setShowCreateForm(true)}
          >
            <PlusIcon className="project-list__icon" />
            New Project
          </button>
        )}
      </header>

      {/* Create form */}
      {showCreateForm && (
        <form className="project-list__create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Project name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="project-list__create-input"
            autoFocus
          />
          <div className="project-list__color-picker">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`project-list__color-swatch ${
                  selectedColor === color ? 'project-list__color-swatch--selected' : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="project-list__create-actions">
            <button
              type="button"
              className="project-list__cancel-btn"
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="project-list__submit-btn"
              disabled={!newName.trim()}
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Project list */}
      {projects.length > 0 ? (
        <div className="project-list__items">
          {projects.map((project) => {
            const count = getTaskCount(project.id);
            return (
              <button
                key={project.id}
                className="project-list__item"
                onClick={() => onSelectProject(project)}
              >
                <span
                  className="project-list__item-dot"
                  style={{ backgroundColor: project.color }}
                />
                <span className="project-list__item-name">{project.name}</span>
                <span className="project-list__item-count">
                  {count} {count === 1 ? 'task' : 'tasks'}
                </span>
                <ChevronIcon className="project-list__chevron" />
              </button>
            );
          })}
        </div>
      ) : (
        !showCreateForm && (
          <div className="project-list__empty">
            <p>No projects yet.</p>
            <p>Create one to group your tasks.</p>
          </div>
        )
      )}
    </div>
  );
}


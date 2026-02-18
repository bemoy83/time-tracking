/**
 * ProjectDetail page.
 * Shows project info, task list, add-task form, and delete project.
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import { BackIcon, TrashIcon, ChevronIcon } from '../components/icons';
import { ProjectColorPicker } from '../components/ProjectColorPicker';
import { ProjectColorDot } from '../components/ProjectColorDot';
import {
  useTaskStore,
  useProjectTasks,
  updateProjectName,
  updateProjectColor,
  getDeleteProjectPreview,
  deleteProjectWithMode,
  DeleteProjectPreview,
} from '../lib/stores/task-store';
import { DeleteProjectConfirm } from '../components/DeleteProjectConfirm';
import { CreateTaskSheet } from '../components/CreateTaskSheet';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onSelectTask: (task: Task) => void;
}

export function ProjectDetail({ projectId, onBack, onSelectTask }: ProjectDetailProps) {
  const { projects } = useTaskStore();
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useProjectTasks(projectId);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeleteProjectPreview | null>(null);

  if (!project) {
    return (
      <div className="project-detail">
        <button className="project-detail__back" onClick={onBack}>
          <BackIcon className="project-detail__icon" />
          <span>Back</span>
        </button>
        <p>Project not found.</p>
      </div>
    );
  }

  const activeTasks = projectTasks.filter((t) => t.status === 'active');
  const completedTasks = projectTasks.filter((t) => t.status === 'completed');
  const blockedTasks = projectTasks.filter((t) => t.status === 'blocked');

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    await updateProjectName(project.id, editName.trim());
    setIsEditingName(false);
  };

  const handleColorChange = async (color: string) => {
    await updateProjectColor(project.id, color);
    setShowColorPicker(false);
  };

  const handleDeleteClick = async () => {
    const preview = await getDeleteProjectPreview(project.id);
    setDeletePreview(preview);
    setShowDeleteConfirm(true);
  };

  const handleDeleteUnassign = async () => {
    await deleteProjectWithMode(project.id, 'unassign');
    setShowDeleteConfirm(false);
    onBack();
  };

  const handleDeleteTasks = async () => {
    await deleteProjectWithMode(project.id, 'delete_tasks');
    setShowDeleteConfirm(false);
    onBack();
  };

  return (
    <div className="project-detail">
      {/* Header */}
      <header className="project-detail__header">
        <button className="project-detail__back" onClick={onBack}>
          <BackIcon className="project-detail__icon" />
          <span>Back</span>
        </button>
      </header>

      {/* Project name + color */}
      <div className="project-detail__title-section">
        <button
          className="project-detail__color-toggle"
          onClick={() => setShowColorPicker(!showColorPicker)}
          aria-label="Change project color"
        >
          <ProjectColorDot color={project.color} size="lg" />
        </button>
        {isEditingName ? (
          <div className="project-detail__edit-name">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input"
              autoFocus
            />
            <button className="btn btn--secondary" onClick={() => setIsEditingName(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={handleSaveName}>
              Save
            </button>
          </div>
        ) : (
          <h1
            className="project-detail__name"
            onClick={() => {
              setEditName(project.name);
              setIsEditingName(true);
            }}
          >
            {project.name}
          </h1>
        )}
      </div>

      {/* Color picker */}
      {showColorPicker && (
        <ProjectColorPicker
          value={project.color}
          onChange={handleColorChange}
        />
      )}

      {/* Stats */}
      <div className="project-detail__stats">
        <span>{activeTasks.length} active</span>
        {completedTasks.length > 0 && <span>{completedTasks.length} completed</span>}
        {blockedTasks.length > 0 && <span>{blockedTasks.length} blocked</span>}
      </div>

      {/* FAB + Create Sheet */}
      <button className="fab" onClick={() => setShowCreateSheet(true)} aria-label="New task">+</button>
      <CreateTaskSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        projectId={projectId}
      />

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section className="project-detail__section">
          <h2 className="project-detail__section-title section-heading">Active</h2>
          <div className="project-detail__task-list">
            {activeTasks.map((task) => (
              <button
                key={task.id}
                className="project-detail__task-item"
                onClick={() => onSelectTask(task)}
              >
                <span className="project-detail__task-title">{task.title}</span>
                <ChevronIcon className="project-detail__chevron" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Blocked tasks */}
      {blockedTasks.length > 0 && (
        <section className="project-detail__section">
          <h2 className="project-detail__section-title section-heading section-heading--blocked">Blocked</h2>
          <div className="project-detail__task-list">
            {blockedTasks.map((task) => (
              <button
                key={task.id}
                className="project-detail__task-item project-detail__task-item--blocked"
                onClick={() => onSelectTask(task)}
              >
                <span className="project-detail__task-title">{task.title}</span>
                <span className="project-detail__blocked-reason">{task.blockedReason}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <section className="project-detail__section">
          <h2 className="project-detail__section-title section-heading section-heading--completed">Completed</h2>
          <div className="project-detail__task-list">
            {completedTasks.map((task) => (
              <button
                key={task.id}
                className="project-detail__task-item project-detail__task-item--completed"
                onClick={() => onSelectTask(task)}
              >
                <span className="project-detail__task-title">{task.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {projectTasks.length === 0 && (
        <div className="project-detail__empty">
          <p>No tasks in this project yet.</p>
          <p>Add one above to get started.</p>
        </div>
      )}

      {/* Delete project */}
      <div className="project-detail__danger-zone">
        <button
          className="btn btn--ghost"
          onClick={handleDeleteClick}
        >
          <TrashIcon className="project-detail__icon" />
          Delete Project
        </button>
      </div>

      {/* Delete confirmation */}
      <DeleteProjectConfirm
        isOpen={showDeleteConfirm}
        projectName={project.name}
        taskCount={deletePreview?.taskCount ?? 0}
        totalTimeMs={deletePreview?.totalTimeMs ?? 0}
        onUnassign={handleDeleteUnassign}
        onDeleteTasks={handleDeleteTasks}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

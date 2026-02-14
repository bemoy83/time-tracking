/**
 * TaskDetailHeader component.
 * Back button, editable title, and project badge for TaskDetail page.
 */

import { useState } from 'react';
import { Task, Project } from '../lib/types';
import { updateTaskTitle } from '../lib/stores/task-store';
import { BackIcon } from './icons';

interface TaskDetailHeaderProps {
  task: Task;
  project: Project | null;
  onBack: () => void;
  onNavigateToProject?: (project: Project) => void;
  onShowProjectPicker: () => void;
}

export function TaskDetailHeader({
  task,
  project,
  onBack,
  onNavigateToProject,
  onShowProjectPicker,
}: TaskDetailHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await updateTaskTitle(task.id, editTitle.trim());
    setIsEditing(false);
  };

  return (
    <>
      <header className="task-detail__header">
        <button className="task-detail__back" onClick={onBack}>
          <BackIcon className="task-detail__icon" />
          <span>Back</span>
        </button>
      </header>

      <div className="task-detail__title-section">
        {isEditing ? (
          <div className="task-detail__edit-title">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="task-detail__title-input"
              autoFocus
            />
            <div className="task-detail__edit-actions">
              <button
                className="task-detail__btn task-detail__btn--secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                className="task-detail__btn task-detail__btn--primary"
                onClick={handleSaveTitle}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <h1
            className="task-detail__title"
            onClick={() => {
              setEditTitle(task.title);
              setIsEditing(true);
            }}
          >
            {task.title}
          </h1>
        )}
        {project ? (
          <button
            className="task-detail__project-badge"
            style={{ borderColor: project.color, color: project.color }}
            onClick={() => onNavigateToProject?.(project)}
          >
            <span
              className="task-detail__project-dot"
              style={{ backgroundColor: project.color }}
            />
            {project.name}
          </button>
        ) : (
          <button
            className="task-detail__project-btn"
            onClick={onShowProjectPicker}
          >
            + Add to project
          </button>
        )}
      </div>
    </>
  );
}

/**
 * TaskDetailHeader component.
 * Merged back-nav + breadcrumb bar, and editable title.
 */

import { useState } from 'react';
import { Task, Project } from '../lib/types';
import { updateTaskTitle } from '../lib/stores/task-store';
import { HomeIcon } from './icons';

interface TaskDetailHeaderProps {
  task: Task;
  project: Project | null;
  parentTask: Task | null;
  onBack: () => void;
  onNavigateToProject?: (project: Project) => void;
  onNavigateToParent?: () => void;
  onShowProjectPicker: () => void;
}

export function TaskDetailHeader({
  task,
  project,
  parentTask,
  onBack,
  onNavigateToProject,
  onNavigateToParent,
  onShowProjectPicker,
}: TaskDetailHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await updateTaskTitle(task.id, editTitle.trim());
    setIsEditing(false);
  };

  const hasBreadcrumb = project || parentTask;

  return (
    <div className="task-detail__title-section">
      {/* Navigation bar: ← back arrow + breadcrumb merged */}
      <nav className="task-detail__breadcrumb">
        <button className="task-detail__breadcrumb-back" onClick={onBack}>
          <HomeIcon className="task-detail__breadcrumb-back-icon" />
        </button>
        {hasBreadcrumb ? (
          <>
            {project && (
              <>
                <span className="task-detail__breadcrumb-sep">›</span>
                <button
                  className="task-detail__breadcrumb-segment"
                  onClick={() => onNavigateToProject?.(project)}
                >
                  <span
                    className="task-detail__breadcrumb-dot"
                    style={{ backgroundColor: project.color }}
                  />
                  {project.name}
                </button>
              </>
            )}
            {parentTask && (
              <>
                <span className="task-detail__breadcrumb-sep">›</span>
                <button
                  className="task-detail__breadcrumb-segment"
                  onClick={onNavigateToParent}
                >
                  {parentTask.title}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className="task-detail__breadcrumb-sep">›</span>
            <button
              className="task-detail__breadcrumb-add"
              onClick={onShowProjectPicker}
            >
              + Add to project
            </button>
          </>
        )}
      </nav>

      {/* Editable title */}
      {isEditing ? (
        <div className="task-detail__edit-title">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input"
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
    </div>
  );
}

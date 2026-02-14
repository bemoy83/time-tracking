/**
 * DeleteProjectConfirm component.
 * Confirmation dialog for deleting a project with two modes:
 * - Unassign all tasks (keep tasks, clear projectId)
 * - Delete project and all tasks (destructive)
 */

import { useRef } from 'react';
import { formatDurationShort } from '../lib/types';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WarningIcon, TrashIcon } from './icons';

interface DeleteProjectConfirmProps {
  isOpen: boolean;
  projectName: string;
  taskCount: number;
  totalTimeMs: number;
  onUnassign: () => void;
  onDeleteTasks: () => void;
  onCancel: () => void;
}

export function DeleteProjectConfirm({
  isOpen,
  projectName,
  taskCount,
  totalTimeMs,
  onUnassign,
  onDeleteTasks,
  onCancel,
}: DeleteProjectConfirmProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onCancel, cancelBtnRef);

  if (!isOpen) return null;

  const hasTasks = taskCount > 0;
  const hasTime = totalTimeMs > 0;

  return (
    <div className="delete-confirm-backdrop" onClick={onCancel} aria-hidden="true">
      <div
        ref={dialogRef}
        className="delete-project-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-project-title" className="delete-confirm__title">
          <WarningIcon className="delete-confirm__icon" />
          Delete project?
        </h2>

        {hasTasks ? (
          <>
            <p id="delete-project-desc" className="delete-confirm__message">
              "{projectName}" has {taskCount} task{taskCount > 1 ? 's' : ''}
              {hasTime ? ` with ${formatDurationShort(totalTimeMs)} of tracked time` : ''}.
            </p>

            <div className="delete-project-confirm__options">
              <button
                className="delete-project-confirm__option delete-project-confirm__option--unassign"
                onClick={onUnassign}
              >
                <strong>Unassign tasks</strong>
                <span>Keep all tasks, remove from project</span>
              </button>

              <button
                className="delete-project-confirm__option delete-project-confirm__option--delete"
                onClick={onDeleteTasks}
              >
                <strong>Delete project and tasks</strong>
                <span>Permanently delete all tasks and tracked time</span>
              </button>
            </div>

            <p className="delete-confirm__warning">This cannot be undone.</p>
          </>
        ) : (
          <p id="delete-project-desc" className="delete-confirm__message">
            This will permanently delete "{projectName}".
          </p>
        )}

        <div className="delete-confirm__actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="delete-confirm__btn delete-confirm__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          {!hasTasks && (
            <button
              type="button"
              className="delete-confirm__btn delete-confirm__btn--delete"
              onClick={onUnassign}
            >
              <TrashIcon className="delete-confirm__btn-icon" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


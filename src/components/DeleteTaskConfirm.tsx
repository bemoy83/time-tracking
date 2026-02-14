/**
 * DeleteTaskConfirm component.
 * Confirmation dialog for deleting a task with time tracking warning.
 *
 * Features:
 * - Accessible dialog with focus trap
 * - Shows time that will be lost
 * - Shows subtask count
 * - Escape key and backdrop click to cancel
 */

import { useRef } from 'react';
import { formatDurationShort } from '../lib/types';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WarningIcon, TrashIcon } from './icons';

interface DeleteTaskConfirmProps {
  isOpen: boolean;
  taskTitle: string;
  totalTimeMs: number;
  subtaskCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTaskConfirm({
  isOpen,
  taskTitle,
  totalTimeMs,
  subtaskCount,
  onConfirm,
  onCancel,
}: DeleteTaskConfirmProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onCancel, cancelBtnRef);

  if (!isOpen) return null;

  const hasTime = totalTimeMs > 0;
  const hasSubtasks = subtaskCount > 0;

  // Build the warning message
  let message = `This will permanently delete "${taskTitle}"`;
  if (hasSubtasks) {
    message += ` and its ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`;
  }
  if (hasTime) {
    message += `, including ${formatDurationShort(totalTimeMs)} of tracked time`;
  }
  message += '.';

  return (
    <div
      className="delete-confirm-backdrop"
      onClick={onCancel}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className="delete-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-confirm-title" className="delete-confirm__title">
          <WarningIcon className="delete-confirm__icon" />
          Delete task?
        </h2>

        <p id="delete-confirm-desc" className="delete-confirm__message">
          {message}
        </p>

        <p className="delete-confirm__warning">
          This cannot be undone.
        </p>

        <div className="delete-confirm__actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="delete-confirm__btn delete-confirm__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-confirm__btn delete-confirm__btn--delete"
            onClick={onConfirm}
          >
            <TrashIcon className="delete-confirm__btn-icon" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}


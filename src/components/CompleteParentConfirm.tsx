/**
 * CompleteParentConfirm component.
 * Shown when completing a parent task that has incomplete subtasks.
 * Offers: Cancel / Complete only / Complete all.
 */

import { useRef } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { CheckIcon } from './icons';

interface CompleteParentConfirmProps {
  isOpen: boolean;
  taskTitle: string;
  incompleteCount: number;
  onCompleteOnly: () => void;
  onCompleteAll: () => void;
  onCancel: () => void;
}

export function CompleteParentConfirm({
  isOpen,
  taskTitle,
  incompleteCount,
  onCompleteOnly,
  onCompleteAll,
  onCancel,
}: CompleteParentConfirmProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onCancel, cancelBtnRef);

  if (!isOpen) return null;

  return (
    <div className="delete-confirm-backdrop" onClick={onCancel} aria-hidden="true">
      <div
        ref={dialogRef}
        className="complete-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="complete-confirm-title"
        aria-describedby="complete-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="complete-confirm-title" className="complete-confirm__title">
          Complete task?
        </h2>

        <p id="complete-confirm-desc" className="complete-confirm__message">
          "{taskTitle}" has {incompleteCount} incomplete subtask{incompleteCount !== 1 ? 's' : ''}.
        </p>

        <div className="complete-confirm__actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="complete-confirm__btn complete-confirm__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="complete-confirm__btn complete-confirm__btn--secondary"
            onClick={onCompleteOnly}
          >
            Complete only
          </button>
          <button
            type="button"
            className="complete-confirm__btn complete-confirm__btn--primary"
            onClick={onCompleteAll}
          >
            <CheckIcon className="complete-confirm__btn-icon" />
            Complete all
          </button>
        </div>
      </div>
    </div>
  );
}


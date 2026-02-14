import { useRef } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WarningIcon, TrashIcon } from './icons';

interface PurgeResetConfirmProps {
  isOpen: boolean;
  taskCount: number;
  projectCount: number;
  entryCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurgeResetConfirm({
  isOpen,
  taskCount,
  projectCount,
  entryCount,
  onConfirm,
  onCancel,
}: PurgeResetConfirmProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onCancel, cancelBtnRef);

  if (!isOpen) return null;

  const parts: string[] = [];
  if (taskCount > 0) parts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
  if (projectCount > 0) parts.push(`${projectCount} project${projectCount !== 1 ? 's' : ''}`);
  if (entryCount > 0) parts.push(`${entryCount} time ${entryCount !== 1 ? 'entries' : 'entry'}`);

  const summary = parts.length > 0
    ? `This will permanently delete ${parts.join(', ')}.`
    : 'This will reset all app data.';

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
        aria-labelledby="purge-reset-title"
        aria-describedby="purge-reset-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="purge-reset-title" className="delete-confirm__title">
          <WarningIcon className="delete-confirm__icon" />
          Reset all data?
        </h2>

        <p id="purge-reset-desc" className="delete-confirm__message">
          {summary}
        </p>

        <p className="delete-confirm__warning">This cannot be undone.</p>

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
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}

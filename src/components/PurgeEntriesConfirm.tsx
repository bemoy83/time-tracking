import { useRef } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WarningIcon, TrashIcon } from './icons';

interface PurgeEntriesConfirmProps {
  isOpen: boolean;
  entryCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurgeEntriesConfirm({
  isOpen,
  entryCount,
  onConfirm,
  onCancel,
}: PurgeEntriesConfirmProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onCancel, cancelBtnRef);

  if (!isOpen) return null;

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
        aria-labelledby="purge-entries-title"
        aria-describedby="purge-entries-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="purge-entries-title" className="delete-confirm__title">
          <WarningIcon className="delete-confirm__icon" />
          Clear time entries?
        </h2>

        <p id="purge-entries-desc" className="delete-confirm__message">
          This will permanently delete all {entryCount} time{' '}
          {entryCount === 1 ? 'entry' : 'entries'}.
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
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}

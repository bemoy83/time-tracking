/**
 * DeleteTaskConfirm component.
 * Confirmation dialog for deleting a task with time tracking warning.
 */

import { formatDurationShort } from '../lib/types';
import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

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
  const hasTime = totalTimeMs > 0;
  const hasSubtasks = subtaskCount > 0;

  let message = `This will permanently delete "${taskTitle}"`;
  if (hasSubtasks) {
    message += ` and its ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`;
  }
  if (hasTime) {
    message += `, including ${formatDurationShort(totalTimeMs)} of tracked time`;
  }
  message += '.';

  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Delete task?"
      titleIcon={<WarningIcon className="delete-confirm__icon" />}
      description={message}
      onClose={onCancel}
      ariaLabelledBy="delete-confirm-title"
      ariaDescribedBy="delete-confirm-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Delete',
          onClick: onConfirm,
          variant: 'danger',
          icon: <TrashIcon className="delete-confirm__btn-icon" />,
        },
      ]}
    >
      <p className="alert-dialog__warning">This cannot be undone.</p>
    </AlertDialog>
  );
}

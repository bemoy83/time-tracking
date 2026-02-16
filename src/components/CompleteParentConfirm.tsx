/**
 * CompleteParentConfirm component.
 * Shown when completing a parent task that has incomplete subtasks.
 * Offers: Cancel / Complete only / Complete all.
 */

import { CheckIcon } from './icons';
import { AlertDialog } from './AlertDialog';

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
  return (
    <AlertDialog
      isOpen={isOpen}
      title="Complete task?"
      description={`"${taskTitle}" has ${incompleteCount} incomplete subtask${incompleteCount !== 1 ? 's' : ''}.`}
      onClose={onCancel}
      ariaLabelledBy="complete-confirm-title"
      ariaDescribedBy="complete-confirm-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        { label: 'Complete only', onClick: onCompleteOnly, variant: 'outline-success' },
        {
          label: 'Complete all',
          onClick: onCompleteAll,
          variant: 'success',
          icon: <CheckIcon className="complete-confirm__btn-icon" />,
        },
      ]}
    />
  );
}

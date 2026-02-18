/**
 * CompleteParentConfirm component.
 * Shown when completing a parent task that has incomplete subtasks.
 * Completing the parent will also complete all subtasks.
 */

import { CheckIcon } from './icons';
import { AlertDialog } from './AlertDialog';
import { pluralize } from '../lib/utils/pluralize';

interface CompleteParentConfirmProps {
  isOpen: boolean;
  taskTitle: string;
  incompleteCount: number;
  onCompleteAll: () => void;
  onCancel: () => void;
}

export function CompleteParentConfirm({
  isOpen,
  taskTitle,
  incompleteCount,
  onCompleteAll,
  onCancel,
}: CompleteParentConfirmProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      title="Complete task?"
      description={`Completing this task will also complete ${pluralize(incompleteCount, 'subtask')}.`}
      onClose={onCancel}
      ariaLabelledBy="complete-confirm-title"
      ariaDescribedBy="complete-confirm-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Complete',
          onClick: onCompleteAll,
          variant: 'success',
          icon: <CheckIcon className="alert-dialog__icon alert-dialog__icon--sm" />,
        },
      ]}
    />
  );
}

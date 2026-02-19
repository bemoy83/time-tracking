/**
 * DeleteTemplateConfirm component.
 * Confirmation dialog for deleting a task template.
 */

import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

interface DeleteTemplateConfirmProps {
  isOpen: boolean;
  templateTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTemplateConfirm({
  isOpen,
  templateTitle,
  onConfirm,
  onCancel,
}: DeleteTemplateConfirmProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Delete template?"
      titleIcon={<WarningIcon className="alert-dialog__icon" />}
      description={`This will permanently delete the template "${templateTitle}".`}
      onClose={onCancel}
      ariaLabelledBy="delete-template-title"
      ariaDescribedBy="delete-template-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Delete',
          onClick: onConfirm,
          variant: 'danger',
          icon: <TrashIcon className="alert-dialog__icon alert-dialog__icon--sm" />,
        },
      ]}
    >
      <p className="alert-dialog__warning">This cannot be undone.</p>
    </AlertDialog>
  );
}

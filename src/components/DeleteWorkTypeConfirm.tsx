import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

interface DeleteWorkTypeConfirmProps {
  isOpen: boolean;
  workTypeTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteWorkTypeConfirm({
  isOpen,
  workTypeTitle,
  onConfirm,
  onCancel,
}: DeleteWorkTypeConfirmProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Delete work type?"
      titleIcon={<WarningIcon className="alert-dialog__icon" />}
      description={`This will permanently delete the work type "${workTypeTitle}".`}
      onClose={onCancel}
      ariaLabelledBy="delete-work-type-title"
      ariaDescribedBy="delete-work-type-desc"
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

import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

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
  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Clear time entries?"
      titleIcon={<WarningIcon className="delete-confirm__icon" />}
      description={`This will permanently delete all ${entryCount} time ${entryCount === 1 ? 'entry' : 'entries'}.`}
      onClose={onCancel}
      ariaLabelledBy="purge-entries-title"
      ariaDescribedBy="purge-entries-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Clear all',
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

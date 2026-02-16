import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';
import { pluralize } from '../lib/utils/pluralize';

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
      titleIcon={<WarningIcon className="alert-dialog__icon" />}
      description={`This will permanently delete all ${pluralize(entryCount, 'time entry', 'time entries')}.`}
      onClose={onCancel}
      ariaLabelledBy="purge-entries-title"
      ariaDescribedBy="purge-entries-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Clear all',
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

import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

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
  const parts: string[] = [];
  if (taskCount > 0) parts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
  if (projectCount > 0) parts.push(`${projectCount} project${projectCount !== 1 ? 's' : ''}`);
  if (entryCount > 0) parts.push(`${entryCount} time ${entryCount !== 1 ? 'entries' : 'entry'}`);

  const summary = parts.length > 0
    ? `This will permanently delete ${parts.join(', ')}.`
    : 'This will reset all app data.';

  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Reset all data?"
      titleIcon={<WarningIcon className="delete-confirm__icon" />}
      description={summary}
      onClose={onCancel}
      ariaLabelledBy="purge-reset-title"
      ariaDescribedBy="purge-reset-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        {
          label: 'Reset all',
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

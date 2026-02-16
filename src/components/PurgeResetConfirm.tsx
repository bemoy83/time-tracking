import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';
import { pluralize } from '../lib/utils/pluralize';

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
  if (taskCount > 0) parts.push(pluralize(taskCount, 'task'));
  if (projectCount > 0) parts.push(pluralize(projectCount, 'project'));
  if (entryCount > 0) parts.push(pluralize(entryCount, 'time entry', 'time entries'));

  const summary = parts.length > 0
    ? `This will permanently delete ${parts.join(', ')}.`
    : 'This will reset all app data.';

  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Reset all data?"
      titleIcon={<WarningIcon className="alert-dialog__icon" />}
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
          icon: <TrashIcon className="alert-dialog__icon alert-dialog__icon--sm" />,
        },
      ]}
    >
      <p className="alert-dialog__warning">This cannot be undone.</p>
    </AlertDialog>
  );
}

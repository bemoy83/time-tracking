/**
 * DeleteProjectConfirm component.
 * Confirmation dialog for deleting a project with two modes:
 * - Unassign all tasks (keep tasks, clear projectId)
 * - Delete project and all tasks (destructive)
 */

import { formatDurationShort } from '../lib/types';
import { WarningIcon, TrashIcon } from './icons';
import { AlertDialog } from './AlertDialog';

interface DeleteProjectConfirmProps {
  isOpen: boolean;
  projectName: string;
  taskCount: number;
  totalTimeMs: number;
  onUnassign: () => void;
  onDeleteTasks: () => void;
  onCancel: () => void;
}

export function DeleteProjectConfirm({
  isOpen,
  projectName,
  taskCount,
  totalTimeMs,
  onUnassign,
  onDeleteTasks,
  onCancel,
}: DeleteProjectConfirmProps) {
  const hasTasks = taskCount > 0;
  const hasTime = totalTimeMs > 0;

  const description = hasTasks
    ? `"${projectName}" has ${taskCount} task${taskCount > 1 ? 's' : ''}${hasTime ? ` with ${formatDurationShort(totalTimeMs)} of tracked time` : ''}.`
    : `This will permanently delete "${projectName}".`;

  return (
    <AlertDialog
      isOpen={isOpen}
      tone="danger"
      title="Delete project?"
      titleIcon={<WarningIcon className="delete-confirm__icon" />}
      description={description}
      onClose={onCancel}
      ariaLabelledBy="delete-project-title"
      ariaDescribedBy="delete-project-desc"
      actions={
        hasTasks
          ? [{ label: 'Cancel', onClick: onCancel, variant: 'secondary' as const }]
          : [
              { label: 'Cancel', onClick: onCancel, variant: 'secondary' as const },
              {
                label: 'Delete',
                onClick: onUnassign,
                variant: 'danger' as const,
                icon: <TrashIcon className="delete-confirm__btn-icon" />,
              },
            ]
      }
    >
      {hasTasks && (
        <>
          <div className="delete-project-confirm__options">
            <button
              className="delete-project-confirm__option delete-project-confirm__option--unassign"
              onClick={onUnassign}
            >
              <strong>Unassign tasks</strong>
              <span>Keep all tasks, remove from project</span>
            </button>

            <button
              className="delete-project-confirm__option delete-project-confirm__option--delete"
              onClick={onDeleteTasks}
            >
              <strong>Delete project and tasks</strong>
              <span>Permanently delete all tasks and tracked time</span>
            </button>
          </div>

          <p className="alert-dialog__warning">This cannot be undone.</p>
        </>
      )}
    </AlertDialog>
  );
}

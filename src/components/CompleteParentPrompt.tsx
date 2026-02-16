/**
 * CompleteParentPrompt component.
 * Shown when completing the last incomplete subtask of a parent.
 * Asks: "All subtasks are done. Also complete [ParentTitle]?"
 */

import { CheckIcon } from './icons';
import { AlertDialog } from './AlertDialog';

interface CompleteParentPromptProps {
  isOpen: boolean;
  parentTitle: string;
  onYes: () => void;
  onNo: () => void;
  onCancel: () => void;
}

export function CompleteParentPrompt({
  isOpen,
  parentTitle,
  onYes,
  onNo,
  onCancel,
}: CompleteParentPromptProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      title="Subtasks complete"
      description={`All subtasks are done. Also complete \u201C${parentTitle}\u201D?`}
      onClose={onCancel}
      ariaLabelledBy="complete-prompt-title"
      ariaDescribedBy="complete-prompt-desc"
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'secondary' },
        { label: 'No', onClick: onNo, variant: 'outline-success' },
        {
          label: 'Yes, complete',
          onClick: onYes,
          variant: 'success',
          icon: <CheckIcon className="complete-prompt__btn-icon" />,
        },
      ]}
    />
  );
}

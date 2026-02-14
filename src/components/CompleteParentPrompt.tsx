/**
 * CompleteParentPrompt component.
 * Shown when completing the last incomplete subtask of a parent.
 * Asks: "All subtasks are done. Also complete [ParentTitle]?"
 */

import { useRef } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { CheckIcon } from './icons';

interface CompleteParentPromptProps {
  isOpen: boolean;
  parentTitle: string;
  onYes: () => void;
  onNo: () => void;
}

export function CompleteParentPrompt({
  isOpen,
  parentTitle,
  onYes,
  onNo,
}: CompleteParentPromptProps) {
  const noBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onNo, noBtnRef);

  if (!isOpen) return null;

  return (
    <div className="delete-confirm-backdrop" onClick={onNo} aria-hidden="true">
      <div
        ref={dialogRef}
        className="complete-prompt"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="complete-prompt-title"
        aria-describedby="complete-prompt-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="complete-prompt-title" className="complete-prompt__title">
          Subtasks complete
        </h2>

        <p id="complete-prompt-desc" className="complete-prompt__message">
          All subtasks are done. Also complete &ldquo;{parentTitle}&rdquo;?
        </p>

        <div className="complete-prompt__actions">
          <button
            ref={noBtnRef}
            type="button"
            className="complete-prompt__btn complete-prompt__btn--cancel"
            onClick={onNo}
          >
            No
          </button>
          <button
            type="button"
            className="complete-prompt__btn complete-prompt__btn--primary"
            onClick={onYes}
          >
            <CheckIcon className="complete-prompt__btn-icon" />
            Yes, complete
          </button>
        </div>
      </div>
    </div>
  );
}


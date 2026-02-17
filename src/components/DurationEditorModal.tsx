/**
 * DurationEditorModal component.
 * Centered modal wrapper around DurationEditorContent.
 * Used by EditEntryModal (kept as centered modal).
 */

import { ReactNode } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { DurationEditorContent } from './DurationEditorContent';

interface DurationEditorModalProps {
  isOpen: boolean;
  title: string;
  initialHours: number;
  initialMinutes: number;
  showWorkers?: boolean;
  initialWorkers?: number;
  showDelete?: boolean;
  showClear?: boolean;
  durationLabel?: string;
  preview?: ReactNode;
  onSave: (hours: number, minutes: number, workers?: number) => void;
  onDelete?: () => void;
  onClear?: () => void;
  onClose: () => void;
}

export function DurationEditorModal({
  isOpen,
  title,
  initialHours,
  initialMinutes,
  showWorkers = false,
  initialWorkers = 1,
  showDelete = false,
  showClear = false,
  durationLabel = 'Duration',
  preview,
  onSave,
  onDelete,
  onClear,
  onClose,
}: DurationEditorModalProps) {
  const dialogRef = useModalFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="entry-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="entry-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="duration-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="duration-editor-title" className="entry-modal__title">{title}</h2>
        <DurationEditorContent
          initialHours={initialHours}
          initialMinutes={initialMinutes}
          showWorkers={showWorkers}
          initialWorkers={initialWorkers}
          showDelete={showDelete}
          showClear={showClear}
          durationLabel={durationLabel}
          preview={preview}
          onSave={onSave}
          onDelete={onDelete}
          onClear={onClear}
          onCancel={onClose}
          resetKey={isOpen ? 1 : 0}
        />
      </div>
    </div>
  );
}

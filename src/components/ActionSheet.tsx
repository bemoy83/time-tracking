/**
 * ActionSheet component.
 * iOS-style bottom panel that slides up from the bottom of the viewport.
 * Generic shell — callers pass content as children.
 */

import { ReactNode } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function ActionSheet({ isOpen, onClose, title, children }: ActionSheetProps) {
  const dialogRef = useModalFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="action-sheet-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-sheet__handle" />
        <h2 className="action-sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

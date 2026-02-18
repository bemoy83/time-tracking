/**
 * ActionSheet component.
 * iOS-style bottom panel that slides up from the bottom of the viewport.
 * Generic shell — callers pass content as children.
 * Uses visualViewport API to stay pinned to the visible bottom when
 * the on-screen keyboard is open.
 */

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function ActionSheet({ isOpen, onClose, title, children }: ActionSheetProps) {
  const dialogRef = useModalFocusTrap(isOpen, onClose);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const updateOffset = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // When keyboard is open, visualViewport.height < window.innerHeight.
    // The gap is how far the keyboard pushes content up.
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    setKeyboardOffset(Math.max(0, offset));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, [isOpen, updateOffset]);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) setKeyboardOffset(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const sheetStyle: React.CSSProperties = {
    '--kb-offset': `${keyboardOffset}px`,
    ...(keyboardOffset > 0 && { paddingBottom: 'var(--space-lg)' }),
  } as React.CSSProperties;

  return (
    <div className="action-sheet-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
      >
        <div className="action-sheet__handle" />
        <h2 className="action-sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

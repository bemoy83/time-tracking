/**
 * ActionSheet component.
 * iOS-style bottom panel that slides up from the bottom of the viewport.
 * Generic shell — callers pass content as children.
 * The sheet stays pinned at the bottom; on-screen keyboards overlay it.
 * Internal overflow scrolls so all content remains reachable.
 *
 * Uses Visual Viewport API to constrain height when keyboard opens (iOS Safari
 * polyfill for interactive-widget=overlays-content).
 */

import { ReactNode, useEffect } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';

/** Top margin when constraining sheet to visual viewport (keyboard open) */
const SHEET_TOP_MARGIN = 32;

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function ActionSheet({ isOpen, onClose, title, children }: ActionSheetProps) {
  const dialogRef = useModalFocusTrap(isOpen, onClose);

  // Constrain sheet max-height to visual viewport when keyboard opens (iOS polyfill)
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const sheet = dialogRef.current;
    const vv = window.visualViewport;

    const updateMaxHeight = () => {
      if (!sheet) return;
      const maxH = Math.max(200, vv.height - SHEET_TOP_MARGIN);
      sheet.style.maxHeight = `${maxH}px`;
    };

    updateMaxHeight();
    vv.addEventListener('resize', updateMaxHeight);
    vv.addEventListener('scroll', updateMaxHeight);
    window.addEventListener('resize', updateMaxHeight);

    return () => {
      vv.removeEventListener('resize', updateMaxHeight);
      vv.removeEventListener('scroll', updateMaxHeight);
      window.removeEventListener('resize', updateMaxHeight);
      sheet.style.maxHeight = '';
    };
  }, [isOpen]);

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

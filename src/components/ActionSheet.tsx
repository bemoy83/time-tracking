/**
 * ActionSheet component.
 * iOS-style bottom panel that slides up from the bottom of the viewport.
 * Generic shell — callers pass content as children.
 *
 * Uses Visual Viewport API to anchor both the backdrop and sheet to the
 * visible area when the iOS keyboard opens, compensating for height *and*
 * offsetTop so content is never pushed off-screen.
 */

import { ReactNode, useEffect, useRef, useCallback } from 'react';
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
  const backdropRef = useRef<HTMLDivElement>(null);

  // Anchor sheet + backdrop to visual viewport (handles iOS keyboard offset)
  const syncViewport = useCallback(() => {
    const sheet = dialogRef.current;
    const backdrop = backdropRef.current;
    const vv = window.visualViewport;
    if (!sheet || !backdrop || !vv) return;

    const offsetTop = vv.offsetTop;
    const vpHeight = vv.height;

    // Position backdrop to cover only the visible viewport
    backdrop.style.top = `${offsetTop}px`;
    backdrop.style.height = `${vpHeight}px`;

    // Constrain sheet max-height within the visible viewport
    const maxH = Math.max(200, vpHeight - SHEET_TOP_MARGIN);
    sheet.style.maxHeight = `${maxH}px`;
  }, [dialogRef]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: number | null = null;
    const onViewportChange = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncViewport();
      });
    };

    // Initial sync
    syncViewport();

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);

    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      if (rafId !== null) cancelAnimationFrame(rafId);

      // Clean up inline styles
      const sheet = dialogRef.current;
      const backdrop = backdropRef.current;
      if (sheet) sheet.style.maxHeight = '';
      if (backdrop) {
        backdrop.style.top = '';
        backdrop.style.height = '';
      }
    };
  }, [isOpen, syncViewport, dialogRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="action-sheet-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
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

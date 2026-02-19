/**
 * useModalFocusTrap hook.
 * Shared modal behavior: focus trap, Escape key, body scroll lock.
 */

import { useEffect, useRef, RefObject } from 'react';

export function useModalFocusTrap(
  isOpen: boolean,
  onClose: () => void,
  autoFocusRef?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus target element when dialog opens
  useEffect(() => {
    if (isOpen && autoFocusRef?.current) {
      autoFocusRef.current.focus();
    }
  }, [isOpen, autoFocusRef]);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open.
  // Uses overflow hidden on html+body instead of position:fixed to avoid
  // iOS keyboard-induced layout shifts on the background content.
  // The ActionSheet's own overscroll-behavior:contain + backdrop touch handler
  // prevents scroll-through on iOS.
  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const { body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);

  return dialogRef;
}

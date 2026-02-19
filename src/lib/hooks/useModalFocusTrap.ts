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

  // Prevent body scroll when open (iOS-safe: fixed-position lock with scrollY restore)
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const { body } = document;
    const prevStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = prevStyles.position;
      body.style.top = prevStyles.top;
      body.style.left = prevStyles.left;
      body.style.right = prevStyles.right;
      body.style.overflow = prevStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  return dialogRef;
}

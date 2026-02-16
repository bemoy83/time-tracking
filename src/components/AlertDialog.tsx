/**
 * AlertDialog component.
 * Unified confirmation/prompt dialog with backdrop, focus trap,
 * configurable tone, and action buttons.
 */

import { useRef, ReactNode } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';

interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline-success';
  icon?: ReactNode;
}

interface AlertDialogProps {
  isOpen: boolean;
  tone?: 'danger' | 'warning' | 'success';
  title: ReactNode;
  titleIcon?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions: AlertAction[];
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export function AlertDialog({
  isOpen,
  title,
  titleIcon,
  description,
  children,
  actions,
  onClose,
  ariaLabelledBy = 'alert-dialog-title',
  ariaDescribedBy = 'alert-dialog-desc',
}: AlertDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, cancelBtnRef);

  if (!isOpen) return null;

  const variantClass = (variant: AlertAction['variant'] = 'secondary') => {
    switch (variant) {
      case 'primary': return 'btn btn--primary btn--lg';
      case 'danger': return 'btn btn--danger btn--lg';
      case 'success': return 'btn btn--success btn--lg';
      case 'ghost': return 'btn btn--ghost btn--lg';
      case 'outline-success': return 'btn alert-dialog__btn--outline-success btn--lg';
      default: return 'btn btn--secondary btn--lg';
    }
  };

  return (
    <div
      className="delete-confirm-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className="alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={description ? ariaDescribedBy : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={ariaLabelledBy} className="alert-dialog__title">
          {titleIcon}
          {title}
        </h2>

        {description && (
          <p id={ariaDescribedBy} className="alert-dialog__message">
            {description}
          </p>
        )}

        {children}

        <div className="alert-dialog__actions">
          {actions.map((action, i) => (
            <button
              key={i}
              ref={i === 0 ? cancelBtnRef : undefined}
              type="button"
              className={variantClass(action.variant)}
              onClick={action.onClick}
            >
              {action.icon && (
                <span className="alert-dialog__btn-icon">{action.icon}</span>
              )}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

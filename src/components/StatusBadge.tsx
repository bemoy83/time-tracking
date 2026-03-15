/**
 * Pill-shaped status badge/chip, shareable across views.
 * Used for plan status (draft, active), confidence levels, and similar labels.
 * Supports both display (span) and action (button) modes.
 */

import type { PlanStatus } from '../lib/planning/plan-model';

export type StatusBadgeVariant =
  | PlanStatus
  | 'ready' /* display mapping for plan status 'active' */
  | 'review-ready'
  | 'reviewed'
  | 'high'
  | 'medium'
  | 'low'
  | 'wrap-up'
  | 'danger';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children?: React.ReactNode;
  /** Render as button for clickable badges (e.g. Wrap Up) */
  as?: 'span' | 'button';
  onClick?: (e: React.MouseEvent) => void;
  'aria-label'?: string;
}

export function StatusBadge({
  variant,
  children,
  as = 'span',
  onClick,
  'aria-label': ariaLabel,
}: StatusBadgeProps) {
  const label = children ?? variant;
  const text = typeof label === 'string' && variant !== 'danger' ? label.toUpperCase() : label;
  const className = `status-badge status-badge--${variant}`;

  if (as === 'button' && onClick != null) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        aria-label={ariaLabel}
      >
        {text}
      </button>
    );
  }

  return <span className={className}>{text}</span>;
}

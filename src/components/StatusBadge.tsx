/**
 * Pill-shaped status badge/chip, shareable across views.
 * Used for plan status (draft, locked), confidence levels, and similar labels.
 */

import type { PlanStatus } from '../lib/planning/plan-model';

export type StatusBadgeVariant =
  | PlanStatus
  | 'review-ready'
  | 'reviewed'
  | 'high'
  | 'medium'
  | 'low';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children?: React.ReactNode;
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const label = children ?? variant;
  return (
    <span className={`status-badge status-badge--${variant}`}>
      {typeof label === 'string' ? label.toUpperCase() : label}
    </span>
  );
}

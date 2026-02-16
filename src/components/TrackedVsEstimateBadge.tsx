/**
 * Reusable badge: "tracked / estimate" when time tracked, "estimate" only when no time tracked.
 * Renders nothing when no estimate is set.
 */

import type { BudgetLevel } from '../lib/types';
import { formatTrackedVsEstimateBadge as formatBadge } from '../lib/types';

interface TrackedVsEstimateBadgeProps {
  trackedMs: number;
  estimatedMinutes: number | null;
  status?: BudgetLevel;
  className?: string;
}

export function TrackedVsEstimateBadge({
  trackedMs,
  estimatedMinutes,
  status,
  className = '',
}: TrackedVsEstimateBadgeProps) {
  const text = formatBadge(trackedMs, estimatedMinutes);
  if (!text) return null;

  const statusClass = status && status !== 'none' ? ` tracked-vs-estimate-badge--${status}` : '';

  return (
    <span
      className={`tracked-vs-estimate-badge${statusClass} ${className}`.trim()}
      aria-label={text}
    >
      {text}
    </span>
  );
}

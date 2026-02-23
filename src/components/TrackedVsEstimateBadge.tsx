/**
 * Reusable badge: "tracked / estimate" when time tracked, "estimate" only when no time tracked.
 * Renders nothing when no estimate is set.
 */

import type { BudgetLevel } from '../lib/types';
import {
  formatTrackedVsEstimateBadge as formatBadge,
  formatTrackedVsEstimateBadgePersonHours as formatPersonBadge,
} from '../lib/types';

interface TrackedVsEstimateBadgeProps {
  trackedMs?: number;
  estimatedMinutes?: number | null;
  trackedPersonMs?: number;
  estimatedPersonMs?: number | null;
  status?: BudgetLevel;
  className?: string;
}

export function TrackedVsEstimateBadge({
  trackedMs,
  estimatedMinutes,
  trackedPersonMs,
  estimatedPersonMs,
  status,
  className = '',
}: TrackedVsEstimateBadgeProps) {
  const usePersonHours = trackedPersonMs != null && estimatedPersonMs != null;
  const text = usePersonHours
    ? formatPersonBadge(trackedPersonMs, estimatedPersonMs)
    : formatBadge(trackedMs ?? 0, estimatedMinutes ?? null);
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

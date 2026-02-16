/**
 * ExpandableSection component.
 * Shared collapsible section with toggle header, optional CountBadge, and rotating chevron.
 *
 * flush: content goes edge-to-edge (no padding/gap). Use for list-style cards
 * where rows should span the full card width.
 */

import { useState } from 'react';
import { CountBadge } from './CountBadge';
import { ClockIcon } from './icons';
import type { BudgetLevel } from '../lib/types';
import { formatDurationShort, formatTrackedVsEstimate } from '../lib/types';

interface ExpandableSectionProps {
  label: string;
  count?: number;
  countVariant?: 'primary' | 'muted';
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  timeBadgeMs?: number;
  estimatedMinutes?: number | null;
  timeBadgeStatus?: BudgetLevel;
  flush?: boolean;
  onToggle?: (isOpen: boolean) => void;
  children: React.ReactNode;
}

export function ExpandableSection({
  label,
  count,
  countVariant = 'muted',
  icon,
  defaultOpen = false,
  badge,
  timeBadgeMs,
  estimatedMinutes,
  timeBadgeStatus,
  flush = false,
  onToggle,
  children,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onToggle?.(next);
  };

  const sectionClass = `expandable-section${flush ? ' expandable-section--flush' : ''}`;
  const contentClass = `expandable-section__content${flush ? ' expandable-section__content--flush' : ''}`;

  return (
    <section className={sectionClass} aria-label={label}>
      <button
        type="button"
        className="expandable-section__toggle"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <span className="expandable-section__label">
          {icon}
          {label}
          {count != null && count > 0 && (
            <CountBadge count={count} variant={countVariant} size="compact" />
          )}
          {badge}
        </span>
        {!isOpen && timeBadgeMs != null && timeBadgeMs > 0 && (
          <span
            className={`expandable-section__time-badge task-card__time-badge${
              timeBadgeStatus && timeBadgeStatus !== 'none'
                ? ` expandable-section__time-badge--${timeBadgeStatus}`
                : ''
            }`}
          >
            <ClockIcon className="task-card__time-badge-icon" />
            {estimatedMinutes != null
              ? formatTrackedVsEstimate(timeBadgeMs, estimatedMinutes)
              : formatDurationShort(timeBadgeMs)}
          </span>
        )}
        <span className={`expandable-section__chevron${isOpen ? ' expandable-section__chevron--open' : ''}`}>
          &#x25B8;
        </span>
      </button>

      {isOpen && (
        <div className={contentClass}>
          {children}
        </div>
      )}
    </section>
  );
}

import type { ReactNode } from 'react';
import { ChevronIcon } from '../../../components/icons';

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

interface ScheduleInputsBlockProps {
  expanded: boolean;
  onToggle: () => void;
  primaryRange: { start: string; end: string } | null;
  dayCount: number;
  crewSize: number | null;
  totalAvailable: number;
  /** When true, shows a hint in the header to complete phase dates (visible even when collapsed). */
  phaseHint?: boolean;
  children: ReactNode;
}

export function ScheduleInputsBlock({
  expanded,
  onToggle,
  primaryRange,
  dayCount,
  crewSize,
  totalAvailable,
  phaseHint = false,
  children,
}: ScheduleInputsBlockProps) {
  return (
    <section className="schedule-view__block schedule-view__block--compact">
      <header className="schedule-view__block-header">
        <button
          type="button"
          className="schedule-view__block-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronIcon
            className={`schedule-view__block-chevron${expanded ? ' schedule-view__block-chevron--expanded' : ''}`}
          />
          <h3 className="schedule-view__block-title">
            Schedule Inputs
            {!expanded && primaryRange != null && (
              <span className="schedule-view__block-summary">
                {' '}
                — {formatShortDate(primaryRange.start)}-
                {formatShortDate(primaryRange.end)} · {dayCount}{' '}
                {dayCount === 1 ? 'day' : 'days'} · {crewSize ?? '–'} crew ·{' '}
                {totalAvailable.toFixed(0)}h available
              </span>
            )}
          </h3>
        </button>
        {phaseHint && (
          <p className="planning-view__schedule-validation planning-view__schedule-validation--hint schedule-view__block-phase-hint">
            Set all four phase dates to enable phase-based scheduling windows.
          </p>
        )}
      </header>
      {expanded && children}
    </section>
  );
}

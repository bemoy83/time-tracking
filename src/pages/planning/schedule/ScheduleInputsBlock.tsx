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
  /** When false, header is static and content is always shown. */
  collapsible?: boolean;
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
  collapsible = true,
  primaryRange,
  dayCount,
  crewSize,
  totalAvailable,
  phaseHint = false,
  children,
}: ScheduleInputsBlockProps) {
  const isExpanded = collapsible ? expanded : true;

  return (
    <section className="schedule-view__block schedule-view__block--compact">
      <header className="schedule-view__block-header">
        {collapsible ? (
          <button
            type="button"
            className="schedule-view__block-toggle"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            <ChevronIcon
              className={`schedule-view__block-chevron${isExpanded ? ' schedule-view__block-chevron--expanded' : ''}`}
            />
            <h3 className="schedule-view__block-title">
              Schedule Inputs
              {!isExpanded && primaryRange != null && (
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
        ) : (
          <h3 className="schedule-view__block-title">Schedule Inputs</h3>
        )}
        {phaseHint && (
          <p className="planning-view__schedule-validation planning-view__schedule-validation--hint schedule-view__block-phase-hint">
            Set start and end for each phase (build-up, tear-down) to enable phase-based scheduling. Phases can be set independently.
          </p>
        )}
      </header>
      {isExpanded && children}
    </section>
  );
}

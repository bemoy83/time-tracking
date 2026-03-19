import { useEffect, useId, useRef, useState } from 'react';
import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';

interface ScheduleGridHeaderProps {
  calendar: WorkCalendarDay[];
  dayByDate: Map<string, DailyCapacity>;
  gridColumns: string;
  label: string;
  onAutoSchedule?: () => void;
  unscheduledCount?: number;
  readOnly?: boolean;
  hasWorkDays?: boolean;
}

function formatDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  const formatted = parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return formatted;
}

/**
 * Format: allocated crew capacity / total work required this day.
 * Numerator = assignedCapacityPersonHours (crew capacity deployed).
 * Denominator = requiredPersonHours + shortfallPersonHours (work needed to meet all targets).
 * Under-allocated when numerator < denominator (shortfall exists).
 * Over-allocated when numerator > denominator (excess crew, flagged by warning color).
 */
function formatUtilBadge(cap: DailyCapacity): string {
  const allocated = cap.assignedCapacityPersonHours;
  const required = cap.requiredPersonHours + cap.shortfallPersonHours;

  if (required <= 0 && allocated <= 0) return '—';
  if (required <= 0) return `${allocated.toFixed(0)}h`;
  if (allocated <= 0) return `${required.toFixed(0)}h needed`;
  return `${allocated.toFixed(0)} / ${required.toFixed(0)}h`;
}

/** Only show over-staffed (amber) when utilization is below this %. Near-full days use default styling. */
const OVER_STAFFED_AMBER_THRESHOLD = 95;
const FRAGMENTATION_TOOLTIP_DELAY_MS = 150;

function buildDayTitle(cap: DailyCapacity | undefined, isWorkDay: boolean): string | undefined {
  if (!cap || !isWorkDay || cap.rawAvailablePersonHours <= 0) return undefined;

  return `${cap.availableCrew} crew · ${cap.accessHours}h/day\nTotal: ${cap.rawAvailablePersonHours.toFixed(1)}h · Usable time: ${cap.effectiveAvailablePersonHours.toFixed(1)}h\nIncludes buffer for movement, setup & coordination`;
}

function formatFragmentationRiskLabel(risk: DailyCapacity['fragmentationRisk']): string {
  if (risk === 'high') return 'High';
  if (risk === 'moderate') return 'Moderate';
  return 'None';
}

function FragmentationWarningIcon({ cap }: { cap: DailyCapacity }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();
  const isHighFragmentation = cap.fragmentationRisk === 'high';
  const rationale = cap.fragmentationRisk === 'high'
    ? 'This day is heavily fragmented and may underperform despite available capacity.'
    : 'This day may lose throughput to switching and coordination.';

  useEffect(() => () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const openWithDelay = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(true);
      timeoutRef.current = null;
    }, FRAGMENTATION_TOOLTIP_DELAY_MS);
  };

  const openImmediately = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const closeTooltip = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  };

  return (
    <span className="schedule-grid__day-warning">
      <button
        type="button"
        className={`schedule-grid__day-warning-icon${isHighFragmentation ? ' schedule-grid__day-warning-icon--high' : ' schedule-grid__day-warning-icon--moderate'}`}
        aria-label={`Fragmentation risk ${formatFragmentationRiskLabel(cap.fragmentationRisk)}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={openWithDelay}
        onMouseLeave={closeTooltip}
        onFocus={openImmediately}
        onBlur={closeTooltip}
      >
        <span className="schedule-grid__day-warning-icon-glyph" aria-hidden="true">▲</span>
      </button>
      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className="schedule-grid__day-warning-tooltip"
        >
          <strong className="schedule-grid__day-warning-tooltip-title">
            Fragmentation risk: {formatFragmentationRiskLabel(cap.fragmentationRisk)}
          </strong>
          <span>Assigned rows: {cap.assignedRowCount}</span>
          <span>Small allocations (&lt;2h): {cap.smallAllocationCount}</span>
          <span>Average allocation: {(cap.averageAllocationPersonHours ?? 0).toFixed(1)}h</span>
          <span>Largest task share: {Math.round((cap.largestAllocationShare ?? 0) * 100)}%</span>
          <span>{rationale}</span>
        </span>
      )}
    </span>
  );
}

export function ScheduleGridHeader({
  calendar,
  dayByDate,
  gridColumns: _gridColumns,
  label,
  onAutoSchedule,
  unscheduledCount,
  readOnly = false,
}: ScheduleGridHeaderProps) {
  return (
    <div className="schedule-grid__header" role="row">
      <div className={`schedule-grid__line-item-col${onAutoSchedule ? ' schedule-grid__line-item-col--with-action' : ''}`} role="columnheader">
        <span className="schedule-grid__line-item-col-label">{label}</span>
        {onAutoSchedule && (
          <button
            type="button"
            className="btn btn--secondary btn--sm schedule-grid__auto-schedule-btn"
            onClick={onAutoSchedule}
            disabled={readOnly || (unscheduledCount ?? 0) === 0}
            aria-label={(unscheduledCount ?? 0) > 0 ? `Auto-schedule ${unscheduledCount} schedulable item${unscheduledCount === 1 ? '' : 's'}` : 'No schedulable items — set phase dates, add crew and time'}
            title={(unscheduledCount ?? 0) > 0 ? `Auto-schedule ${unscheduledCount} item${unscheduledCount === 1 ? '' : 's'} with crew, time, and phase work days` : 'Set phase dates and add crew/time to items to enable'}
          >
            Auto-schedule ({unscheduledCount ?? 0})
          </button>
        )}
      </div>
      {calendar.map((day) => {
        const cap = dayByDate.get(day.date);
        const isOver = cap?.isOverAllocated ?? false;
        const utilizationPct = cap && cap.availableCrew > 0 ? (cap.assignedCrewTotal / cap.availableCrew) * 100 : 0;
        const showOverStaffedWarning = (cap?.isOverStaffed ?? false) && utilizationPct < OVER_STAFFED_AMBER_THRESHOLD;
        const isFragmented = cap?.fragmentationRisk === 'moderate' || cap?.fragmentationRisk === 'high';
        return (
          <span
            key={day.date}
            role="columnheader"
            className={`schedule-grid__day-col${day.isWorkDay ? '' : ' schedule-grid__day-col--off'}${isOver ? ' schedule-grid__day-col--over' : ''}${cap?.isOverAssignedCrew ? ' schedule-grid__day-col--over-crew' : ''}${cap?.isOverWorkerCapacity ? ' schedule-grid__day-col--over-worker' : ''}${showOverStaffedWarning ? ' schedule-grid__day-col--over-staffed' : ''}`}
            title={buildDayTitle(cap, day.isWorkDay)}
          >
            <span className="schedule-grid__day-label-row">
              <span className="schedule-grid__day-label">{formatDayLabel(day.date)}</span>
              {isFragmented && cap && <FragmentationWarningIcon cap={cap} />}
            </span>
            {cap && day.isWorkDay && (
              <>
                {(() => {
                  if (cap.availableCrew <= 0 || cap.assignedCrewTotal <= 0) return null;
                  const pct = Math.min(Math.round((cap.assignedCrewTotal / cap.availableCrew) * 100), 100);
                  const fillClass = cap.isOverAllocated
                    ? ' schedule-grid__day-bar-fill--over'
                    : showOverStaffedWarning
                      ? ' schedule-grid__day-bar-fill--under'
                      : '';
                  return (
                    <span
                      className="schedule-grid__day-bar"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${pct}% crew utilization`}
                    >
                      <span
                        className={`schedule-grid__day-bar-fill${fillClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  );
                })()}
                <span className={`schedule-grid__day-util${isOver ? ' schedule-grid__day-util--over' : ''}${cap.isOverWorkerCapacity ? ' schedule-grid__day-util--over-worker' : ''}${isFragmented && !isOver && !cap.isOverWorkerCapacity && !showOverStaffedWarning ? ' schedule-grid__day-util--fragmented' : ''}`}>
                  {formatUtilBadge(cap)}
                </span>
                {cap.assignedCrewTotal > 0 && (
                  <span className={`schedule-grid__day-crew${cap.isOverAssignedCrew ? ' schedule-grid__day-crew--over' : ''}`}>
                    {parseFloat(cap.assignedCrewTotal.toFixed(2))}/{cap.availableCrew} crew
                  </span>
                )}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import { OVER_STAFFED_AMBER_THRESHOLD } from '../../../../lib/planning/scheduling/capacity-core';
import type { PhaseDateValues } from '../schedule-date-ui';
import { FragmentationWarningIcon } from './FragmentationWarningIcon';

interface ScheduleGridHeaderProps {
  calendar: WorkCalendarDay[];
  dayByDate: Map<string, DailyCapacity>;
  gridColumns: string;
  label: string;
  onAutoSchedule?: () => void;
  unscheduledCount?: number;
  readOnly?: boolean;
  hasWorkDays?: boolean;
  phaseDates?: PhaseDateValues;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  onToggleWorkday?: (date: string) => void;
  todayIso?: string;
}

type DayPhase = 'assembly' | 'event' | 'dismantle' | null;

function getDayPhase(
  date: string,
  phaseDates: PhaseDateValues | undefined,
  eventStartDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): DayPhase {
  if (!phaseDates) return null;
  if (
    phaseDates.assemblyStartDate &&
    phaseDates.assemblyEndDate &&
    date >= phaseDates.assemblyStartDate &&
    date <= phaseDates.assemblyEndDate
  ) {
    return 'assembly';
  }
  if (
    eventStartDate &&
    eventEndDate &&
    date >= eventStartDate &&
    date <= eventEndDate
  ) {
    return 'event';
  }
  if (
    phaseDates.dismantleStartDate &&
    phaseDates.dismantleEndDate &&
    date >= phaseDates.dismantleStartDate &&
    date <= phaseDates.dismantleEndDate
  ) {
    return 'dismantle';
  }
  return null;
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

function buildDayTitle(cap: DailyCapacity | undefined, isWorkDay: boolean): string | undefined {
  if (!cap || !isWorkDay || cap.rawAvailablePersonHours <= 0) return undefined;

  return `${cap.availableCrew} crew · ${cap.accessHours}h/day\nTotal: ${cap.rawAvailablePersonHours.toFixed(1)}h · Usable time: ${cap.effectiveAvailablePersonHours.toFixed(1)}h\nIncludes buffer for movement, setup & coordination`;
}

export function ScheduleGridHeader({
  calendar,
  dayByDate,
  gridColumns: _gridColumns,
  label,
  onAutoSchedule,
  unscheduledCount,
  readOnly = false,
  phaseDates,
  eventStartDate,
  eventEndDate,
  onToggleWorkday,
  todayIso,
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
        const isToday = todayIso != null && day.date === todayIso;
        const dayPhase = getDayPhase(day.date, phaseDates, eventStartDate, eventEndDate);
        return (
          <span
            key={day.date}
            role="columnheader"
            data-date={day.date}
            className={[
              'schedule-grid__day-col',
              day.isWorkDay ? '' : 'schedule-grid__day-col--off',
              isOver ? 'schedule-grid__day-col--over' : '',
              cap?.isOverAssignedCrew ? 'schedule-grid__day-col--over-crew' : '',
              cap?.isOverWorkerCapacity ? 'schedule-grid__day-col--over-worker' : '',
              showOverStaffedWarning ? 'schedule-grid__day-col--over-staffed' : '',
              isToday ? 'schedule-grid__day-col--today' : '',
            ].filter(Boolean).join(' ')}
            title={buildDayTitle(cap, day.isWorkDay)}
          >
            <span className="schedule-grid__day-label-row">
              {onToggleWorkday && !readOnly ? (
                <button
                  type="button"
                  className={`schedule-grid__day-toggle${isToday ? ' schedule-grid__day-toggle--today' : ''}`}
                  onClick={() => onToggleWorkday(day.date)}
                  aria-label={day.isWorkDay ? `Remove ${formatDayLabel(day.date)} as work day` : `Add ${formatDayLabel(day.date)} as work day`}
                  title={day.isWorkDay ? 'Click to mark as off day' : 'Click to add as work day'}
                >
                  {formatDayLabel(day.date)}
                </button>
              ) : (
                <span className={`schedule-grid__day-label${isToday ? ' schedule-grid__day-label--today' : ''}`}>
                  {formatDayLabel(day.date)}
                </span>
              )}
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
            {dayPhase && (
              <span
                className={`schedule-grid__day-phase-bar schedule-grid__day-phase-bar--${dayPhase}`}
                aria-hidden
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

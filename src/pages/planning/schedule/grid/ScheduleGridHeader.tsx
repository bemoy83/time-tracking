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
  onEditDay?: (date: string, anchor: HTMLElement) => void;
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

function formatDayAbbr(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

function formatDayNum(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric' });
}

function formatShortTime(time: string | null | undefined): string {
  if (!time) return '';
  return time.replace(/^0/, '').replace(/:00$/, '');
}

function formatAccessWindow(day: WorkCalendarDay): string {
  const start = formatShortTime(day.accessStart ?? '08:00');
  const end = formatShortTime(day.accessEnd ?? '16:00');
  return start && end ? `${start}-${end}` : 'hours unset';
}

function formatStaffedCrewCount(cap: DailyCapacity): string {
  const assigned = parseFloat(cap.assignedCrewTotal.toFixed(2));
  return `${assigned}/${cap.availableCrew} crew`;
}

function isWeekendDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00`).getDay();
  return d === 0 || d === 6;
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
  onEditDay,
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
        const accessWindow = formatAccessWindow(day);
        const crewCount = cap ? formatStaffedCrewCount(cap) : '';
        const dayMetaLabel = `${crewCount}${accessWindow ? `, ${accessWindow}` : ''}`;
        return (
          <span
            key={day.date}
            role="columnheader"
            data-date={day.date}
            className={[
              'schedule-grid__day-col',
              isWeekendDate(day.date) ? 'schedule-grid__day-col--weekend' : '',
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
                  <span className="schedule-grid__day-abbr">{formatDayAbbr(day.date)}</span>
                  <span className="schedule-grid__day-num">{formatDayNum(day.date)}</span>
                </button>
              ) : (
                <span className={`schedule-grid__day-label${isToday ? ' schedule-grid__day-label--today' : ''}`}>
                  <span className="schedule-grid__day-abbr">{formatDayAbbr(day.date)}</span>
                  <span className="schedule-grid__day-num">{formatDayNum(day.date)}</span>
                </span>
              )}
              {isFragmented && cap && <FragmentationWarningIcon cap={cap} />}
            </span>
            {cap && day.isWorkDay && (
              <>
                {(() => {
                  const hasUtilization = cap.availableCrew > 0 && cap.assignedCrewTotal > 0;
                  const pct = hasUtilization
                    ? Math.min(Math.round((cap.assignedCrewTotal / cap.availableCrew) * 100), 100)
                    : 0;
                  const fillClass = cap.isOverAllocated
                    ? ' schedule-grid__day-bar-fill--over'
                    : showOverStaffedWarning
                      ? ' schedule-grid__day-bar-fill--under'
                      : '';
                  return (
                    <span
                      className={`schedule-grid__day-bar${hasUtilization ? '' : ' schedule-grid__day-bar--placeholder'}`}
                      role={hasUtilization ? 'progressbar' : undefined}
                      aria-valuenow={hasUtilization ? pct : undefined}
                      aria-valuemin={hasUtilization ? 0 : undefined}
                      aria-valuemax={hasUtilization ? 100 : undefined}
                      aria-label={hasUtilization ? `${pct}% crew utilization` : undefined}
                      aria-hidden={hasUtilization ? undefined : true}
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
                {onEditDay && !readOnly ? (
                  <button
                    type="button"
                    className={`schedule-grid__day-meta schedule-grid__day-meta--editable${cap.isOverAssignedCrew ? ' schedule-grid__day-meta--over' : ''}`}
                    onClick={(e) => onEditDay(day.date, e.currentTarget)}
                    aria-label={`Edit crew and hours for ${formatDayLabel(day.date)}: ${dayMetaLabel}`}
                    title="Edit crew size and hours"
                  >
                    <span className="schedule-grid__day-meta-crew">{crewCount}</span>
                    <span className="schedule-grid__day-meta-time">{accessWindow}</span>
                  </button>
                ) : (
                  <span className={`schedule-grid__day-meta${cap.isOverAssignedCrew ? ' schedule-grid__day-meta--over' : ''}`}>
                    <span className="schedule-grid__day-meta-crew">{crewCount}</span>
                    <span className="schedule-grid__day-meta-time">{accessWindow}</span>
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

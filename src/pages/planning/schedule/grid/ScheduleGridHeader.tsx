import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import { OVER_STAFFED_AMBER_THRESHOLD } from '../../../../lib/planning/scheduling/capacity-core';
import { FragmentationWarningIcon } from './FragmentationWarningIcon';

interface ScheduleGridHeaderProps {
  calendar: WorkCalendarDay[];
  dayByDate: Map<string, DailyCapacity>;
  gridColumns: string;
  label: string;
  onAutoSchedule?: () => void;
  unscheduledCount?: number;
  readOnly?: boolean;
  onToggleWorkday?: (date: string) => void;
  todayIso?: string;
  onEditDay?: (date: string, anchor: HTMLElement) => void;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
}

function formatDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
  onToggleWorkday,
  todayIso,
  onEditDay,
  eventStartDate,
  eventEndDate,
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
        const utilizationPct = cap && cap.availableCrew > 0
          ? (cap.assignedCrewTotal / cap.availableCrew) * 100
          : 0;
        const showOverStaffedWarning = (cap?.isOverStaffed ?? false) && utilizationPct < OVER_STAFFED_AMBER_THRESHOLD;
        const isFragmented = cap?.fragmentationRisk === 'moderate' || cap?.fragmentationRisk === 'high';
        const isToday = todayIso != null && day.date === todayIso;
        const isEventDay = !!(eventStartDate && eventEndDate
          && day.date >= eventStartDate && day.date <= eventEndDate);
        const accessWindow = formatAccessWindow(day);
        const crewCount = cap ? formatStaffedCrewCount(cap) : '';
        const dayMetaLabel = `${crewCount}${accessWindow ? `, ${accessWindow}` : ''}`;

        // Utilization bar at absolute bottom
        const utilPct = cap && cap.availableCrew > 0
          ? Math.min(Math.round((cap.assignedCrewTotal / cap.availableCrew) * 100), 100)
          : 0;
        const utilBarVariant = isOver
          ? ' schedule-grid__day-util-bar--over'
          : showOverStaffedWarning
            ? ' schedule-grid__day-util-bar--under'
            : '';

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
              {onToggleWorkday && !readOnly && !isEventDay ? (
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
              onEditDay && !readOnly ? (
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
              )
            )}

            {cap && day.isWorkDay && utilPct > 0 && (
              <span
                className={`schedule-grid__day-util-bar${utilBarVariant}`}
                style={{ '--util-pct': `${utilPct}%` } as React.CSSProperties}
                role="progressbar"
                aria-valuenow={utilPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${utilPct}% crew utilization`}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

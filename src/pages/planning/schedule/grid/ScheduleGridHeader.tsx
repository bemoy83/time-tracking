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
}

function formatDayLabel(date: string, index: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  const formatted = parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `Day ${index + 1} | ${formatted}`;
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

export function ScheduleGridHeader({
  calendar,
  dayByDate,
  gridColumns,
  label,
  onAutoSchedule,
  unscheduledCount,
  readOnly = false,
}: ScheduleGridHeaderProps) {
  return (
    <div className="schedule-grid__header" role="row" style={{ gridTemplateColumns: gridColumns }}>
      <div className={`schedule-grid__line-item-col${onAutoSchedule ? ' schedule-grid__line-item-col--with-action' : ''}`} role="columnheader">
        <span className="schedule-grid__line-item-col-label">{label}</span>
        {onAutoSchedule && (
          <button
            type="button"
            className="btn btn--secondary btn--sm schedule-grid__auto-schedule-btn"
            onClick={onAutoSchedule}
            disabled={readOnly || (unscheduledCount ?? 0) === 0}
            aria-label={(unscheduledCount ?? 0) > 0 ? `Auto-schedule ${unscheduledCount} unscheduled item${unscheduledCount === 1 ? '' : 's'}` : 'No unscheduled items'}
          >
            Auto-schedule ({unscheduledCount ?? 0})
          </button>
        )}
      </div>
      {calendar.map((day, index) => {
        const cap = dayByDate.get(day.date);
        const isOver = cap?.isOverAllocated ?? false;
        return (
          <span
            key={day.date}
            role="columnheader"
            className={`schedule-grid__day-col${day.isWorkDay ? '' : ' schedule-grid__day-col--off'}${isOver ? ' schedule-grid__day-col--over' : ''}${cap?.isOverAssignedCrew ? ' schedule-grid__day-col--over-crew' : ''}${cap?.isOverWorkerCapacity ? ' schedule-grid__day-col--over-worker' : ''}${cap?.isOverStaffed ? ' schedule-grid__day-col--over-staffed' : ''}`}
          >
            <span className="schedule-grid__day-label">{formatDayLabel(day.date, index)}</span>
            {cap && day.isWorkDay && (
              <>
                {(() => {
                  const required = cap.requiredPersonHours + cap.shortfallPersonHours;
                  if (required <= 0) return null;
                  const pct = Math.round((cap.assignedCapacityPersonHours / required) * 100);
                  const barWidth = Math.min(pct, 100);
                  return (
                    <span
                      className="schedule-grid__day-bar"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${pct}% capacity used`}
                    >
                      <span
                        className={`schedule-grid__day-bar-fill${cap.isOverAllocated ? ' schedule-grid__day-bar-fill--over' : ''}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </span>
                  );
                })()}
                <span className={`schedule-grid__day-util${isOver ? ' schedule-grid__day-util--over' : ''}${cap.isOverWorkerCapacity ? ' schedule-grid__day-util--over-worker' : ''}${cap.isOverStaffed ? ' schedule-grid__day-util--over-staffed' : ''}`}>
                  {formatUtilBadge(cap)}
                </span>
                {cap.assignedCrewTotal > 0 && (
                  <span className={`schedule-grid__day-crew${cap.isOverAssignedCrew ? ' schedule-grid__day-crew--over' : ''}`}>
                    {cap.assignedCrewTotal}/{cap.availableCrew} crew
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

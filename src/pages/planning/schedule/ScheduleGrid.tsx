import type { PlanLineItem, WorkCalendarDay } from '../../../lib/planning/plan-model';
import { BUILD_PHASE_LABELS, WORK_UNIT_LABELS } from '../../../lib/types';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { getAssignedDates } from '../../../lib/planning/scheduling/assignment';

interface ScheduleGridProps {
  lineItems: PlanLineItem[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  readOnly: boolean;
  onToggleAssignment: (lineItem: PlanLineItem, date: string) => void;
}

function formatDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function ScheduleGrid({
  lineItems,
  calendar,
  capacity,
  readOnly,
  onToggleAssignment,
}: ScheduleGridProps) {
  const dayByDate = new Map(capacity.days.map((day) => [day.date, day]));
  const unscheduled = lineItems.filter((item) => item.scheduledStart == null || item.scheduledEnd == null);

  return (
    <section className="schedule-view__block">
      <header className="schedule-view__block-header">
        <h3 className="schedule-view__block-title">Schedule Grid</h3>
      </header>

      {calendar.length === 0 ? (
        <p className="schedule-view__muted">Set event start and end dates to open the schedule grid.</p>
      ) : (
        <div className="schedule-grid">
          <div className="schedule-grid__header">
            <span className="schedule-grid__line-item-col">Work package</span>
            {calendar.map((day) => (
              <span key={day.date} className={`schedule-grid__day-col${day.isWorkDay ? '' : ' schedule-grid__day-col--off'}`}>
                {formatDayLabel(day.date)}
              </span>
            ))}
          </div>

          <div className="schedule-grid__body">
            {lineItems.map((item) => {
              const assigned = new Set(getAssignedDates(item));
              return (
                <div key={item.id} className="schedule-grid__row">
                  <div className="schedule-grid__line-item">
                    <span className="schedule-grid__line-item-title">{item.title}</span>
                    <span className="schedule-grid__line-item-meta">
                      {BUILD_PHASE_LABELS[item.buildPhase]} · {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]} · {(item.timeHours * item.crew).toFixed(1)}h
                    </span>
                  </div>
                  {calendar.map((day) => (
                    <button
                      key={`${item.id}:${day.date}`}
                      type="button"
                      className={`schedule-grid__cell${assigned.has(day.date) ? ' schedule-grid__cell--assigned' : ''}${day.isWorkDay ? '' : ' schedule-grid__cell--off'}`}
                      onClick={() => onToggleAssignment(item, day.date)}
                      disabled={readOnly || !day.isWorkDay}
                      aria-label={`Toggle ${item.title} on ${day.date}`}
                    >
                      {assigned.has(day.date) ? '●' : ''}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="schedule-grid__footer">
            <span className="schedule-grid__line-item-col">Utilization</span>
            {calendar.map((day) => {
              const cap = dayByDate.get(day.date);
              if (!cap) return <span key={`${day.date}-empty`} className="schedule-grid__summary-col">-</span>;
              const ratio = cap.utilization == null ? '-' : `${Math.round(cap.utilization * 100)}%`;
              return (
                <span
                  key={`${day.date}-summary`}
                  className={`schedule-grid__summary-col${cap.isOverAllocated ? ' schedule-grid__summary-col--over' : ''}`}
                >
                  {cap.requiredPersonHours.toFixed(1)} / {cap.availablePersonHours.toFixed(1)}h ({ratio})
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="schedule-view__unscheduled">
        <h4 className="schedule-view__unscheduled-title">Unscheduled ({unscheduled.length})</h4>
        {unscheduled.length === 0 ? (
          <p className="schedule-view__muted">All work packages are placed.</p>
        ) : (
          <ul className="schedule-view__unscheduled-list">
            {unscheduled.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

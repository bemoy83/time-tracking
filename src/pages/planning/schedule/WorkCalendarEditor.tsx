import type { WorkCalendarDay } from '../../../lib/planning/plan-model';

interface WorkCalendarEditorProps {
  calendar: WorkCalendarDay[];
  readOnly: boolean;
  onUpdateDay: (date: string, updates: Partial<WorkCalendarDay>) => void;
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function WorkCalendarEditor({
  calendar,
  readOnly,
  onUpdateDay,
}: WorkCalendarEditorProps) {
  return (
    <section className="schedule-view__block">
      <header className="schedule-view__block-header">
        <h3 className="schedule-view__block-title">Work Calendar</h3>
      </header>
      {calendar.length === 0 ? (
        <p className="schedule-view__muted">No calendar days yet.</p>
      ) : (
        <div className="schedule-calendar">
          {calendar.map((day) => (
            <div key={day.date} className="schedule-calendar__row">
              <span className="schedule-calendar__date">{formatDay(day.date)}</span>
              <label className="schedule-calendar__toggle">
                <input
                  type="checkbox"
                  checked={day.isWorkDay}
                  disabled={readOnly}
                  onChange={(event) => onUpdateDay(day.date, {
                    isWorkDay: event.target.checked,
                    accessStart: event.target.checked ? (day.accessStart ?? '08:00') : null,
                    accessEnd: event.target.checked ? (day.accessEnd ?? '16:00') : null,
                    crewSize: event.target.checked ? day.crewSize : null,
                  })}
                />
                <span>Work day</span>
              </label>
              <input
                className="input schedule-calendar__time"
                type="time"
                value={day.accessStart ?? ''}
                disabled={readOnly || !day.isWorkDay}
                onChange={(event) => onUpdateDay(day.date, { accessStart: event.target.value || null })}
              />
              <input
                className="input schedule-calendar__time"
                type="time"
                value={day.accessEnd ?? ''}
                disabled={readOnly || !day.isWorkDay}
                onChange={(event) => onUpdateDay(day.date, { accessEnd: event.target.value || null })}
              />
              <input
                className="input schedule-calendar__crew"
                type="number"
                min={0}
                step={1}
                value={day.crewSize ?? ''}
                placeholder="default"
                disabled={readOnly || !day.isWorkDay}
                onChange={(event) => onUpdateDay(day.date, {
                  crewSize: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                })}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

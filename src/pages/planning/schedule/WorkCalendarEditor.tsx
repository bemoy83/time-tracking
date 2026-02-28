import { useState } from 'react';
import type { WorkCalendarDay } from '../../../lib/planning/plan-model';
import { ChevronIcon } from '../../../components/icons';

interface WorkCalendarEditorProps {
  calendar: WorkCalendarDay[];
  readOnly: boolean;
  onUpdateDay: (date: string, updates: Partial<WorkCalendarDay>) => void;
  planDefaultCrewSize?: number | null;
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
  planDefaultCrewSize,
}: WorkCalendarEditorProps) {
  const [expanded, setExpanded] = useState(false);

  const crewPlaceholder =
    planDefaultCrewSize != null ? `Crew (override)` : 'default';

  return (
    <section className="schedule-view__block">
      <header className="schedule-view__block-header">
        <button
          type="button"
          className="schedule-view__block-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <ChevronIcon
            className={`schedule-view__block-chevron${expanded ? ' schedule-view__block-chevron--expanded' : ''}`}
          />
          <h3 className="schedule-view__block-title">
            Work Calendar
            {!expanded && calendar.length > 0 && (
              <span className="schedule-view__block-count"> ({calendar.length} days)</span>
            )}
          </h3>
        </button>
      </header>
      {expanded && (
        <>
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
                    placeholder={crewPlaceholder}
                    disabled={readOnly || !day.isWorkDay}
                    onChange={(event) => onUpdateDay(day.date, {
                      crewSize: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                    })}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

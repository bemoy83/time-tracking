import { useState, useRef, useEffect } from 'react';
import type { WorkCalendarDay } from '../../../lib/planning/plan-model';
import { ChevronIcon, PeopleIcon } from '../../../components/icons';

interface WorkCalendarEditorProps {
  calendar: WorkCalendarDay[];
  readOnly: boolean;
  onUpdateDay: (date: string, updates: Partial<WorkCalendarDay>) => void;
  planDefaultCrewSize?: number | null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the Monday of the week containing `dateStr` (local time). */
function getMondayOf(dateStr: string): Date {
  const d = parseDate(dateStr);
  const dow = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dow + 6) % 7));
  return monday;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

interface WeekGroup {
  /** 0-based index within the event for "Wk N" label. */
  weekIndex: number;
  /** The 7 slots [Mon…Sun]; null = date is out of the calendar range. */
  days: (WorkCalendarDay | null)[];
  /** Date objects for each slot (for display). */
  dates: Date[];
}

function groupByWeek(calendar: WorkCalendarDay[]): WeekGroup[] {
  if (calendar.length === 0) return [];

  const byDate = new Map(calendar.map((d) => [d.date, d]));
  const firstMonday = getMondayOf(calendar[0].date);
  const lastMonday = getMondayOf(calendar[calendar.length - 1].date);

  const weeks: WeekGroup[] = [];
  let cursor = new Date(firstMonday);
  let weekIndex = 0;

  while (cursor <= lastMonday) {
    const days: (WorkCalendarDay | null)[] = [];
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const slotDate = addDays(cursor, i);
      const dateStr = formatLocalDate(slotDate);
      dates.push(slotDate);
      days.push(byDate.get(dateStr) ?? null);
    }
    weeks.push({ weekIndex, days, dates });
    cursor = addDays(cursor, 7);
    weekIndex++;
  }

  return weeks;
}

/** Trims leading zero from time strings: "08:00" → "8:00". */
function shortTime(t: string | null): string {
  if (!t) return '';
  return t.replace(/^0/, '');
}

function buildSummary(calendar: WorkCalendarDay[], defaultCrew: number | null): string {
  if (calendar.length === 0) return '';
  const workDays = calendar.filter((d) => d.isWorkDay);
  if (workDays.length === 0) return `${calendar.length} days · all off`;

  const starts = new Set(workDays.map((d) => d.accessStart));
  const ends = new Set(workDays.map((d) => d.accessEnd));
  const crews = new Set(workDays.map((d) => d.crewSize ?? defaultCrew));

  const timeStr =
    starts.size === 1 && ends.size === 1
      ? `${shortTime(workDays[0].accessStart)}–${shortTime(workDays[0].accessEnd)}`
      : 'mixed hours';

  const crewVal = [...crews][0];
  const crewStr =
    crews.size === 1
      ? `crew ${crewVal ?? '?'}`
      : 'mixed crew';

  return `${workDays.length} work days · ${timeStr} · ${crewStr}`;
}

// ---------------------------------------------------------------------------
// DayCell
// ---------------------------------------------------------------------------

type EditingField = 'start' | 'end' | 'crew' | null;

interface DayCellProps {
  day: WorkCalendarDay | null;
  date: Date;
  readOnly: boolean;
  defaultCrew: number | null;
  onUpdate: (date: string, updates: Partial<WorkCalendarDay>) => void;
}

function DayCell({ day, date, readOnly, defaultCrew, onUpdate }: DayCellProps) {
  const dateStr = formatLocalDate(date);
  const dayNum = date.getDate();
  const [editing, setEditing] = useState<EditingField>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (editing !== 'crew') {
        // select all for time inputs
        try { inputRef.current.select(); } catch { /* no-op */ }
      }
    }
  }, [editing]);

  // Out-of-range (calendar doesn't include this date at all)
  if (!day) {
    return (
      <div className="wc-cell wc-cell--out-of-range" aria-hidden="true">
        <span className="wc-cell__day-num">{dayNum}</span>
      </div>
    );
  }

  const isWork = day.isWorkDay;
  const crewDisplay = day.crewSize ?? defaultCrew;

  function handleToggle() {
    onUpdate(dateStr, {
      isWorkDay: !isWork,
      accessStart: !isWork ? (day!.accessStart ?? '08:00') : null,
      accessEnd: !isWork ? (day!.accessEnd ?? '16:00') : null,
      crewSize: !isWork ? day!.crewSize : null,
    });
  }

  function commitEditing() {
    setEditing(null);
  }

  return (
    <div
      className={`wc-cell ${isWork ? 'wc-cell--work' : 'wc-cell--off'}`}
      role="gridcell"
    >
      {/* Header row: date number (= toggle) + crew */}
      <div className="wc-cell__header">
        <button
          type="button"
          className={`wc-cell__day-num${!readOnly ? ' wc-cell__day-num--toggle' : ''}`}
          onClick={!readOnly ? handleToggle : undefined}
          disabled={readOnly}
          title={isWork ? 'Set as off day' : 'Set as work day'}
          aria-label={`${dayNum} — ${isWork ? 'click to set off' : 'click to set as work day'}`}
          aria-pressed={isWork}
        >
          {dayNum}
        </button>

        {isWork && (
          <div className="wc-cell__crew">
            <PeopleIcon className="wc-cell__crew-icon" />
            {editing === 'crew' ? (
              <input
                ref={inputRef}
                type="number"
                className="wc-cell__input wc-cell__input--crew"
                min={0}
                step={1}
                value={day.crewSize ?? ''}
                placeholder={String(defaultCrew ?? '')}
                onBlur={commitEditing}
                onChange={(e) =>
                  onUpdate(dateStr, {
                    crewSize:
                      e.target.value === ''
                        ? null
                        : Math.max(0, Number(e.target.value)),
                  })
                }
              />
            ) : (
              <button
                type="button"
                className={`wc-cell__value${day.crewSize == null ? ' wc-cell__value--inherited' : ''}`}
                onClick={() => !readOnly && setEditing('crew')}
                disabled={readOnly}
                title={
                  day.crewSize == null
                    ? `Plan default (${defaultCrew ?? '?'})`
                    : undefined
                }
              >
                {crewDisplay ?? '?'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Time range row — only on work days */}
      {isWork && (
        <div className="wc-cell__times">
          {editing === 'start' ? (
            <input
              ref={inputRef}
              type="time"
              className="wc-cell__input"
              value={day.accessStart ?? '08:00'}
              onBlur={commitEditing}
              onChange={(e) => onUpdate(dateStr, { accessStart: e.target.value || null })}
            />
          ) : (
            <button
              type="button"
              className="wc-cell__value"
              onClick={() => !readOnly && setEditing('start')}
              disabled={readOnly}
            >
              {shortTime(day.accessStart) || '8:00'}
            </button>
          )}
          <span className="wc-cell__sep" aria-hidden="true">–</span>
          {editing === 'end' ? (
            <input
              ref={inputRef}
              type="time"
              className="wc-cell__input"
              value={day.accessEnd ?? '16:00'}
              onBlur={commitEditing}
              onChange={(e) => onUpdate(dateStr, { accessEnd: e.target.value || null })}
            />
          ) : (
            <button
              type="button"
              className="wc-cell__value"
              onClick={() => !readOnly && setEditing('end')}
              disabled={readOnly}
            >
              {shortTime(day.accessEnd) || '16:00'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkCalendarEditor
// ---------------------------------------------------------------------------

export function WorkCalendarEditor({
  calendar,
  readOnly,
  onUpdateDay,
  planDefaultCrewSize,
}: WorkCalendarEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const weeks = groupByWeek(calendar);
  const defaultCrew = planDefaultCrewSize ?? null;

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
              <span className="schedule-view__block-count">
                {' '}· {buildSummary(calendar, defaultCrew)}
              </span>
            )}
          </h3>
        </button>
      </header>

      {expanded && (
        <>
          {calendar.length === 0 ? (
            <p className="schedule-view__muted">No calendar days yet.</p>
          ) : (
            <div className="work-calendar-scroller">
              <div className="work-calendar-grid" role="grid" aria-label="Work calendar">
                {/* Column headers: blank week-label cell + Mon–Sun */}
                <div className="wc-col-head wc-col-head--label" role="columnheader" aria-label="Week" />
                {DAY_NAMES.map((name) => (
                  <div key={name} className="wc-col-head" role="columnheader">
                    {name}
                  </div>
                ))}

                {/* Week rows */}
                {weeks.map((week) => (
                  <div key={week.weekIndex} className="wc-week-row" role="row">
                    <div className="wc-week-label" role="rowheader">
                      Wk {week.weekIndex + 1}
                    </div>
                    {week.days.map((day, colIdx) => (
                      <DayCell
                        key={colIdx}
                        day={day}
                        date={week.dates[colIdx]}
                        readOnly={readOnly}
                        defaultCrew={defaultCrew}
                        onUpdate={onUpdateDay}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

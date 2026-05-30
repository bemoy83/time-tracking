import { useState, useCallback, useMemo } from 'react';
import type { WorkCalendarDay } from '../../../lib/planning/plan-model';
import type { PhaseDateValues } from './schedule-date-ui';
import { classifyDayZone } from '../../../lib/planning/scheduling/schedule-span';
import { useScheduleEditContext } from '../workspace/ScheduleEditContext';

interface ThumbCalendarProps {
  calendar: WorkCalendarDay[];
  phaseDates: PhaseDateValues;
}

function toIso(d: Date): string {
  return d.toLocaleDateString('en-CA');
}


function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMonthLabel(yyyyMm: string): string {
  return new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthWeeks(yyyyMm: string): string[][] {
  const first = new Date(`${yyyyMm}-01T00:00:00`);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0);

  const startDay = first.getDay();
  first.setDate(first.getDate() + (startDay === 0 ? -6 : 1 - startDay));

  const endDay = lastDay.getDay();
  lastDay.setDate(lastDay.getDate() + (endDay === 0 ? 0 : 7 - endDay));

  const weeks: string[][] = [];
  const cur = new Date(first);
  while (cur <= lastDay) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(toIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthsInRange(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const cur = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const endMonth = endDate.slice(0, 7);
  while (toIso(cur).slice(0, 7) <= endMonth) {
    months.push(toIso(cur).slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type ZoneLabel = 'assembly' | 'moving-in' | 'event' | 'moving-out' | 'dismantle';

export function ThumbCalendar({ calendar, phaseDates }: ThumbCalendarProps) {
  const ctx = useScheduleEditContext();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calendarByDate = useMemo(
    () => new Map(calendar.map((d) => [d.date, d])),
    [calendar],
  );

  const calendarStart = calendar[0]?.date ?? '';
  const calendarEnd = calendar[calendar.length - 1]?.date ?? '';
  const todayIso = new Date().toLocaleDateString('en-CA');
  const plan = ctx?.currentPlan ?? null;
  const eventStartDate = plan?.eventStartDate ?? null;
  const eventEndDate = plan?.eventEndDate ?? null;
  const defaultCrew = ctx?.effectiveCrewSize ?? plan?.defaultCrewSize ?? null;

  const months = useMemo(
    () => (calendarStart && calendarEnd ? getMonthsInRange(calendarStart, calendarEnd) : []),
    [calendarStart, calendarEnd],
  );

  const initialMonth = useMemo(() => {
    if (months.length === 0) return '';
    const todayMonth = todayIso.slice(0, 7);
    return months.includes(todayMonth) ? todayMonth : months[0];
  }, [months, todayIso]);

  const [viewMonth, setViewMonth] = useState<string>(initialMonth);

  const monthIndex = months.indexOf(viewMonth);
  const canPrev = monthIndex > 0;
  const canNext = monthIndex < months.length - 1;

  const visibleWeeks = useMemo(() => getMonthWeeks(viewMonth), [viewMonth]);

  const handleCellClick = useCallback((date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  }, []);

  const selectedDay = selectedDate ? calendarByDate.get(selectedDate) ?? null : null;

  const selectedIsExtendedZone = useMemo(() => {
    if (!selectedDate || selectedDate < calendarStart || selectedDate > calendarEnd) return false;
    const z = classifyDayZone(selectedDate, phaseDates, eventStartDate, eventEndDate);
    return z === 'moving-in' || z === 'moving-out';
  }, [selectedDate, calendarStart, calendarEnd, phaseDates, eventStartDate, eventEndDate]);

  const handleToggleWorkday = useCallback(() => {
    if (!selectedDate || !ctx) return;
    if (!selectedDay) {
      // No calendar entry yet (extended zone day) — create it as a work day
      ctx.onUpdateCalendarDay(selectedDate, { isWorkDay: true });
      return;
    }
    const nowWork = !selectedDay.isWorkDay;
    ctx.onUpdateCalendarDay(selectedDate, {
      isWorkDay: nowWork,
      accessStart: nowWork ? (selectedDay.accessStart ?? '08:00') : null,
      accessEnd: nowWork ? (selectedDay.accessEnd ?? '16:00') : null,
      crewSize: nowWork ? selectedDay.crewSize : null,
    });
  }, [ctx, selectedDate, selectedDay]);

  // Summary: total work days and count per zone (full calendar, not just viewMonth)
  const summary = useMemo(() => {
    const counts: Partial<Record<ZoneLabel, number>> = {};
    let total = 0;
    for (const day of calendar) {
      if (!day.isWorkDay) continue;
      total++;
      const zone = classifyDayZone(day.date, phaseDates, eventStartDate, eventEndDate);
      if (zone !== 'outside') {
        counts[zone as ZoneLabel] = (counts[zone as ZoneLabel] ?? 0) + 1;
      }
    }
    return { total, counts };
  }, [calendar, phaseDates, eventStartDate, eventEndDate]);

  if (months.length === 0) return null;

  return (
    <div className="thumb-calendar" aria-label="Month overview">
      {/* Month navigation */}
      <div className="thumb-calendar__month-nav">
        <button
          type="button"
          className="thumb-calendar__month-btn"
          onClick={() => setViewMonth(months[monthIndex - 1])}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="thumb-calendar__month-label">{formatMonthLabel(viewMonth)}</span>
        <button
          type="button"
          className="thumb-calendar__month-btn"
          onClick={() => setViewMonth(months[monthIndex + 1])}
          disabled={!canNext}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="thumb-calendar__header" aria-hidden>
        <span className="thumb-calendar__week-label-col" />
        {DAY_HEADERS.map((d) => (
          <span key={d} className="thumb-calendar__day-header">{d}</span>
        ))}
      </div>

      {/* Week rows */}
      {visibleWeeks.map((week) => (
        <div key={week[0]} className="thumb-calendar__row">
          <span className="thumb-calendar__week-label" aria-hidden />
          {week.map((date) => {
            const inRange = date >= calendarStart && date <= calendarEnd;
            const calDay = calendarByDate.get(date);
            const zone = inRange
              ? classifyDayZone(date, phaseDates, eventStartDate, eventEndDate)
              : 'outside';
            const isExtendedZone = zone === 'moving-in' || zone === 'moving-out';
            const isOff = calDay ? !calDay.isWorkDay : isExtendedZone;
            const isToday = date === todayIso;
            const isSelected = date === selectedDate;
            const dayNum = parseInt(date.slice(8), 10);

            if (!inRange) {
              return (
                <span
                  key={date}
                  className="thumb-calendar__cell thumb-calendar__cell--out"
                  aria-hidden
                >
                  {dayNum}
                </span>
              );
            }

            return (
              <button
                key={date}
                type="button"
                className={[
                  'thumb-calendar__cell',
                  zone !== 'outside' ? `thumb-calendar__cell--${zone}` : '',
                  isOff ? 'thumb-calendar__cell--off' : '',
                  isToday ? 'thumb-calendar__cell--today' : '',
                  isSelected ? 'thumb-calendar__cell--selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleCellClick(date)}
                aria-label={`${date}${isToday ? ' (today)' : ''}${isOff ? ' (off day)' : ''} — click to ${isSelected ? 'deselect' : 'edit'}`}
                aria-pressed={isSelected}
                disabled={!ctx}
              >
                {dayNum}
                {isToday && <span className="thumb-calendar__today-dot" aria-hidden />}
              </button>
            );
          })}
        </div>
      ))}

      {/* Summary line */}
      {summary.total > 0 && (
        <div className="thumb-calendar__summary">
          <span>{summary.total} work days</span>
          {(['assembly', 'moving-in', 'event', 'moving-out', 'dismantle'] as ZoneLabel[])
            .filter((z) => (summary.counts[z] ?? 0) > 0)
            .map((z) => (
              <span key={z}> · {summary.counts[z]} {z}</span>
            ))}
        </div>
      )}

      {/* Day editor — always rendered to avoid layout shift */}
      <div className="thumb-calendar__day-editor">
        {selectedDate && (selectedDay || selectedIsExtendedZone) && ctx ? (
          <>
            <div className="thumb-calendar__day-editor-header">
              <span className="thumb-calendar__day-editor-date">
                {formatDayLabel(selectedDate)}
              </span>
              <button
                type="button"
                className={`thumb-calendar__day-editor-toggle${(selectedDay?.isWorkDay ?? false) ? '' : ' thumb-calendar__day-editor-toggle--off'}`}
                onClick={handleToggleWorkday}
                disabled={ctx.readOnly}
              >
                {(selectedDay?.isWorkDay ?? false) ? 'Work day' : 'Off day'}
              </button>
            </div>

            {selectedDay?.isWorkDay && (
              <div className="thumb-calendar__day-editor-fields">
                <label className="thumb-calendar__day-editor-field">
                  <span className="thumb-calendar__day-editor-label">Crew</span>
                  <input
                    type="number"
                    className="thumb-calendar__day-editor-input"
                    min={0}
                    step={1}
                    value={selectedDay.crewSize ?? ''}
                    placeholder={String(defaultCrew ?? '')}
                    disabled={ctx.readOnly}
                    onChange={(e) =>
                      ctx.onUpdateCalendarDay(selectedDate, {
                        crewSize: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label className="thumb-calendar__day-editor-field">
                  <span className="thumb-calendar__day-editor-label">Start</span>
                  <input
                    type="time"
                    className="thumb-calendar__day-editor-input"
                    value={selectedDay.accessStart ?? '08:00'}
                    disabled={ctx.readOnly}
                    onChange={(e) =>
                      ctx.onUpdateCalendarDay(selectedDate, { accessStart: e.target.value || null })
                    }
                  />
                </label>
                <label className="thumb-calendar__day-editor-field">
                  <span className="thumb-calendar__day-editor-label">End</span>
                  <input
                    type="time"
                    className="thumb-calendar__day-editor-input"
                    value={selectedDay.accessEnd ?? '16:00'}
                    disabled={ctx.readOnly}
                    onChange={(e) =>
                      ctx.onUpdateCalendarDay(selectedDate, { accessEnd: e.target.value || null })
                    }
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              className="thumb-calendar__day-editor-jump"
              onClick={() => ctx.onScrollToDate(selectedDate)}
            >
              Jump to {formatDayLabel(selectedDate)} in grid ↗
            </button>
          </>
        ) : (
          <span className="thumb-calendar__day-editor-placeholder">
            Select a day to edit
          </span>
        )}
      </div>
    </div>
  );
}

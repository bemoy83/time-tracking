import { useCallback, useRef } from 'react';
import type { WorkCalendarDay } from '../../../lib/planning/plan-model';
import type { PhaseDateValues } from './schedule-date-ui';
import { useScheduleEditContext } from '../workspace/ScheduleEditContext';

interface ThumbCalendarProps {
  calendar: WorkCalendarDay[];
  phaseDates: PhaseDateValues;
}

type CellPhase = 'assembly' | 'event' | 'dismantle' | null;

function getCellPhase(
  date: string,
  phaseDates: PhaseDateValues,
  plan: { eventStartDate?: string | null; eventEndDate?: string | null } | null,
): CellPhase {
  if (
    phaseDates.assemblyStartDate &&
    phaseDates.assemblyEndDate &&
    date >= phaseDates.assemblyStartDate &&
    date <= phaseDates.assemblyEndDate
  ) {
    return 'assembly';
  }
  if (
    plan?.eventStartDate &&
    plan?.eventEndDate &&
    date >= plan.eventStartDate &&
    date <= plan.eventEndDate
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

function toIso(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function getCalendarWeeks(calendar: WorkCalendarDay[]): string[][] {
  if (calendar.length === 0) return [];

  const firstDate = calendar[0].date;
  const lastDate = calendar[calendar.length - 1].date;

  const start = new Date(`${firstDate}T00:00:00`);
  const startDay = start.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  start.setDate(start.getDate() + mondayOffset);

  const end = new Date(`${lastDate}T00:00:00`);
  const endDay = end.getDay();
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  end.setDate(end.getDate() + sundayOffset);

  const weeks: string[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(toIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function ThumbCalendar({ calendar, phaseDates }: ThumbCalendarProps) {
  const ctx = useScheduleEditContext();
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calendarByDate = new Map(calendar.map((d) => [d.date, d]));
  const weeks = getCalendarWeeks(calendar);
  const calendarStart = calendar[0]?.date ?? '';
  const calendarEnd = calendar[calendar.length - 1]?.date ?? '';
  const todayIso = new Date().toLocaleDateString('en-CA');
  const plan = ctx?.currentPlan ?? null;

  const handleCellClick = useCallback((date: string, el: HTMLButtonElement) => {
    ctx?.onScrollToDate(date);
    el.focus();
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    el.dataset.focused = 'true';
    focusTimeoutRef.current = setTimeout(() => {
      delete el.dataset.focused;
    }, 1500);
  }, [ctx]);

  if (weeks.length === 0) return null;

  return (
    <div className="thumb-calendar" aria-label="Month overview">
      <div className="thumb-calendar__header" aria-hidden>
        <span className="thumb-calendar__week-label-col" />
        {DAY_HEADERS.map((d) => (
          <span key={d} className="thumb-calendar__day-header">{d}</span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={week[0]} className="thumb-calendar__row">
          <span className="thumb-calendar__week-label" aria-hidden>W{wi + 1}</span>
          {week.map((date) => {
            const inRange = date >= calendarStart && date <= calendarEnd;
            const calDay = calendarByDate.get(date);
            const isOff = calDay ? !calDay.isWorkDay : false;
            const phase = inRange ? getCellPhase(date, phaseDates, plan) : null;
            const isToday = date === todayIso;
            const dayNum = parseInt(date.slice(8), 10);

            if (!inRange) {
              return <span key={date} className="thumb-calendar__cell thumb-calendar__cell--out" aria-hidden />;
            }

            return (
              <button
                key={date}
                type="button"
                className={[
                  'thumb-calendar__cell',
                  phase ? `thumb-calendar__cell--${phase}` : '',
                  isOff ? 'thumb-calendar__cell--off' : '',
                  isToday ? 'thumb-calendar__cell--today' : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => handleCellClick(date, e.currentTarget)}
                aria-label={`${date}${isToday ? ' (today)' : ''}${isOff ? ' (off day)' : ''}`}
                disabled={!ctx}
              >
                {dayNum}
                {isToday && <span className="thumb-calendar__today-dot" aria-hidden />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

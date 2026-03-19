import {
  type Plan,
  type PlanDateSpan,
  type WorkCalendarDay,
  getPlanEffectiveSpan,
  normalizePlanEfficiency,
} from '../plan-model';
import type { DateSpan } from './schedule-span';

const DEFAULT_WORKDAY_START = '08:00';
const DEFAULT_WORKDAY_END = '16:00';

function parseDatePart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  const parsed = parseDatePart(date);
  if (!parsed) return date;
  parsed.setDate(parsed.getDate() + days);
  return formatLocalDate(parsed);
}

export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function listDateRange(startDate: string, endDate: string): string[] {
  const start = parseDatePart(startDate);
  const end = parseDatePart(endDate);
  if (!start || !end) return [];
  if (start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function listDatesForSpans(spans: DateSpan[]): string[] {
  if (spans.length === 0) return [];
  const unique = new Set<string>();
  for (const span of spans) {
    const dates = listDateRange(span.start, span.end);
    for (const date of dates) {
      unique.add(date);
    }
  }
  return [...unique].sort(compareDateStrings);
}

function buildDefaultDay(date: string, _defaultCrewSize: number | null): WorkCalendarDay {
  const parsed = parseDatePart(date);
  const isWeekend = parsed ? parsed.getDay() === 0 || parsed.getDay() === 6 : false;
  if (isWeekend) {
    return {
      date,
      isWorkDay: false,
      accessStart: null,
      accessEnd: null,
      crewSize: null,
      efficiency: null,
    };
  }
  return {
    date,
    isWorkDay: true,
    accessStart: DEFAULT_WORKDAY_START,
    accessEnd: DEFAULT_WORKDAY_END,
    crewSize: null,
    efficiency: null,
  };
}

export function generateDefaultWorkCalendar(
  startDate: string | null,
  endDate: string | null,
  defaultCrewSize: number | null,
): WorkCalendarDay[] {
  if (!startDate || !endDate) return [];
  const dates = listDateRange(startDate, endDate);
  return dates.map((date) => buildDefaultDay(date, defaultCrewSize));
}

export function generateDefaultWorkCalendarForSpans(
  spans: DateSpan[],
  defaultCrewSize: number | null,
): WorkCalendarDay[] {
  const dates = listDatesForSpans(spans);
  return dates.map((date) => buildDefaultDay(date, defaultCrewSize));
}

export function normalizeWorkCalendarDay(
  day: WorkCalendarDay,
  defaultCrewSize: number | null,
): WorkCalendarDay {
  if (!day.isWorkDay) {
    return {
      ...day,
      isWorkDay: false,
      accessStart: null,
      accessEnd: null,
      crewSize: null,
      efficiency: day.efficiency ?? null,
    };
  }
  return {
    ...day,
    isWorkDay: true,
    accessStart: day.accessStart ?? DEFAULT_WORKDAY_START,
    accessEnd: day.accessEnd ?? DEFAULT_WORKDAY_END,
    crewSize: day.crewSize ?? defaultCrewSize,
    efficiency: day.efficiency ?? null,
  };
}

export function reconcileWorkCalendar(
  existing: WorkCalendarDay[],
  startDate: string | null,
  endDate: string | null,
  defaultCrewSize: number | null,
): WorkCalendarDay[] {
  if (!startDate || !endDate) return [];

  const defaults = generateDefaultWorkCalendar(startDate, endDate, defaultCrewSize);
  const existingByDate = new Map(existing.map((day) => [day.date, day]));

  return defaults.map((fallback) => {
    const preserved = existingByDate.get(fallback.date);
    if (!preserved) return fallback;
    return normalizeWorkCalendarDay(
      {
        ...fallback,
        ...preserved,
        date: fallback.date,
      },
      defaultCrewSize,
    );
  });
}

export function reconcileWorkCalendarForSpans(
  existing: WorkCalendarDay[],
  spans: DateSpan[],
  defaultCrewSize: number | null,
): WorkCalendarDay[] {
  if (spans.length === 0) return [];

  const defaults = generateDefaultWorkCalendarForSpans(spans, defaultCrewSize);
  const existingByDate = new Map(existing.map((day) => [day.date, day]));

  return defaults.map((fallback) => {
    const preserved = existingByDate.get(fallback.date);
    if (!preserved) return fallback;
    return normalizeWorkCalendarDay(
      {
        ...fallback,
        ...preserved,
        date: fallback.date,
      },
      defaultCrewSize,
    );
  });
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

export function dayAccessHours(day: WorkCalendarDay): number {
  if (!day.isWorkDay) return 0;
  const start = parseTimeToMinutes(day.accessStart);
  const end = parseTimeToMinutes(day.accessEnd);
  if (start == null || end == null || end <= start) return 0;
  return (end - start) / 60;
}

export function dayCrewSize(day: WorkCalendarDay, defaultCrewSize: number | null): number {
  return Math.max(0, day.crewSize ?? defaultCrewSize ?? 0);
}

export function dayAvailablePersonHours(day: WorkCalendarDay, defaultCrewSize: number | null): number {
  return dayAccessHours(day) * dayCrewSize(day, defaultCrewSize);
}

/**
 * Resolve effective efficiency for a single day.
 * Per-day efficiency (when set) overrides the plan-level default.
 * Future hook: set day.efficiency in the work calendar editor to enable per-day control.
 */
export function resolveDayEfficiency(
  day: WorkCalendarDay,
  planEfficiency: number,
): number {
  if (day.efficiency == null) return planEfficiency;
  return normalizePlanEfficiency(day.efficiency) ?? planEfficiency;
}

export function dayEffectiveAvailablePersonHours(
  day: WorkCalendarDay,
  defaultCrewSize: number | null,
  planEfficiency: number,
): number {
  return dayAvailablePersonHours(day, defaultCrewSize) * resolveDayEfficiency(day, planEfficiency);
}

export function hasSchedulingCalendar(plan: Pick<Plan, 'workCalendar'>): boolean {
  return plan.workCalendar.length > 0;
}

export function getEffectiveScheduleSpan(
  plan: Pick<
    Plan,
    | 'eventStartDate'
    | 'eventEndDate'
    | 'assemblyStartDate'
    | 'assemblyEndDate'
    | 'dismantleStartDate'
    | 'dismantleEndDate'
  >,
): PlanDateSpan | null {
  return getPlanEffectiveSpan(plan);
}

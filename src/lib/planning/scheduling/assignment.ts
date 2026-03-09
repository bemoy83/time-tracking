import type { PhaseFields } from '../plan-model';
import { addDays, compareDateStrings } from './work-calendar';

export interface ScheduleSpan {
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export function getAssignedDates(pf: Pick<PhaseFields, 'scheduledStart' | 'scheduledEnd'>): string[] {
  if (!pf.scheduledStart || !pf.scheduledEnd) return [];
  if (compareDateStrings(pf.scheduledStart, pf.scheduledEnd) > 0) return [];

  const dates: string[] = [];
  let cursor = pf.scheduledStart;
  while (compareDateStrings(cursor, pf.scheduledEnd) <= 0) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Toggle day assignment while keeping a contiguous date span.
 * If a middle day is removed, the item becomes unscheduled to avoid split ranges.
 */
export function toggleAssignmentDate(
  pf: Pick<PhaseFields, 'scheduledStart' | 'scheduledEnd'>,
  date: string,
): ScheduleSpan {
  const start = pf.scheduledStart;
  const end = pf.scheduledEnd;

  if (!start || !end) {
    return { scheduledStart: date, scheduledEnd: date };
  }

  if (compareDateStrings(date, start) < 0) {
    return { scheduledStart: date, scheduledEnd: end };
  }

  if (compareDateStrings(date, end) > 0) {
    return { scheduledStart: start, scheduledEnd: date };
  }

  if (start === end && start === date) {
    return { scheduledStart: null, scheduledEnd: null };
  }

  if (date === start) {
    return { scheduledStart: addDays(start, 1), scheduledEnd: end };
  }

  if (date === end) {
    return { scheduledStart: start, scheduledEnd: addDays(end, -1) };
  }

  return { scheduledStart: null, scheduledEnd: null };
}

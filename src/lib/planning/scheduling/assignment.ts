import type { PhaseFields } from '../plan-model';
import { addDays, compareDateStrings } from './work-calendar';

export interface ScheduleSpan {
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface ToggleResult {
  span: ScheduleSpan;
  crewByDate: Record<string, number> | undefined;
}

export function getAssignedDates(
  pf: Pick<PhaseFields, 'scheduledStart' | 'scheduledEnd' | 'crewByDate'>,
): string[] {
  if (!pf.scheduledStart || !pf.scheduledEnd) return [];
  if (compareDateStrings(pf.scheduledStart, pf.scheduledEnd) > 0) return [];

  const dates: string[] = [];
  let cursor = pf.scheduledStart;
  while (compareDateStrings(cursor, pf.scheduledEnd) <= 0) {
    if (!pf.crewByDate || (pf.crewByDate[cursor] ?? 0) > 0) {
      dates.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Toggle day assignment with sparse crewByDate support.
 * Gaps are allowed within the span — toggling a middle day zeros its crew
 * instead of clearing the entire span.
 */
export function toggleAssignmentDate(
  pf: Pick<PhaseFields, 'scheduledStart' | 'scheduledEnd' | 'crewByDate' | 'crew'>,
  date: string,
): ToggleResult {
  const start = pf.scheduledStart;
  const end = pf.scheduledEnd;

  // No existing span — create single-day span
  if (!start || !end) {
    return {
      span: { scheduledStart: date, scheduledEnd: date },
      crewByDate: { [date]: 1 },
    };
  }

  const crewByDate = pf.crewByDate ? { ...pf.crewByDate } : undefined;

  // Date before span — extend start
  if (compareDateStrings(date, start) < 0) {
    const nextCrewByDate = crewByDate ?? {};
    nextCrewByDate[date] = 1;
    return {
      span: { scheduledStart: date, scheduledEnd: end },
      crewByDate: nextCrewByDate,
    };
  }

  // Date after span — extend end
  if (compareDateStrings(date, end) > 0) {
    const nextCrewByDate = crewByDate ?? {};
    nextCrewByDate[date] = 1;
    return {
      span: { scheduledStart: start, scheduledEnd: date },
      crewByDate: nextCrewByDate,
    };
  }

  // Date inside span — check current crew
  const currentCrew = crewByDate ? (crewByDate[date] ?? 0) : pf.crew;

  if (currentCrew > 0) {
    // Currently assigned — toggle OFF (set crew to 0)
    const nextCrewByDate = crewByDate ? { ...crewByDate } : undefined;
    if (nextCrewByDate) {
      delete nextCrewByDate[date];
    }

    // Check if any dates still have crew > 0
    const hasAnyCrew = nextCrewByDate
      ? Object.values(nextCrewByDate).some((c) => c > 0)
      : false;

    if (!hasAnyCrew) {
      // No crew left — clear span entirely
      return {
        span: { scheduledStart: null, scheduledEnd: null },
        crewByDate: undefined,
      };
    }

    return {
      span: { scheduledStart: start, scheduledEnd: end },
      crewByDate: nextCrewByDate,
    };
  } else {
    // Currently gap — toggle ON (set crew to 1)
    const nextCrewByDate = crewByDate ?? {};
    nextCrewByDate[date] = 1;
    return {
      span: { scheduledStart: start, scheduledEnd: end },
      crewByDate: nextCrewByDate,
    };
  }
}

import type { DailyEffortMap, PhaseFields } from '../plan-model';
import { getAssignedDatesFromEffortMap, recomputeScheduledSpanFromEffortMap } from '../plan-model';

export interface ScheduleSpan {
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface ToggleResult {
  span: ScheduleSpan;
  personHoursByDate: DailyEffortMap | undefined;
}

export function getAssignedDates(
  pf: Pick<PhaseFields, 'personHoursByDate'>,
): string[] {
  return getAssignedDatesFromEffortMap(pf.personHoursByDate);
}

/**
 * Toggle day assignment with sparse personHoursByDate support.
 * Gaps are allowed within the span — toggling a middle day removes its effort
 * instead of clearing the entire span.
 */
export function toggleAssignmentDate(
  pf: Pick<PhaseFields, 'personHoursByDate'>,
  date: string,
  defaultPersonHours: number,
): ToggleResult {
  const nextPersonHoursByDate = { ...(pf.personHoursByDate ?? {}) };
  if ((nextPersonHoursByDate[date] ?? 0) > 0) {
    delete nextPersonHoursByDate[date];
  } else {
    nextPersonHoursByDate[date] = Number(Math.max(defaultPersonHours, 0.01).toFixed(2));
  }

  const normalized = Object.keys(nextPersonHoursByDate).length > 0
    ? nextPersonHoursByDate
    : undefined;
  return {
    span: recomputeScheduledSpanFromEffortMap(normalized),
    personHoursByDate: normalized,
  };
}

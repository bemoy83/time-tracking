import type { Plan, WorkCalendarDay } from '../plan-model';
import { reconcileWorkCalendar } from './work-calendar';

export function normalizeDefaultCrewSize(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

export function setPlanEventDate(
  plan: Plan,
  field: 'eventStartDate' | 'eventEndDate',
  value: string,
): Plan {
  const next = {
    ...plan,
    [field]: value || null,
  };
  return {
    ...next,
    workCalendar: reconcileWorkCalendar(
      next.workCalendar,
      next.eventStartDate,
      next.eventEndDate,
      next.defaultCrewSize,
    ),
  };
}

export function setPlanDefaultCrewSize(plan: Plan, value: string): Plan {
  const next = {
    ...plan,
    defaultCrewSize: normalizeDefaultCrewSize(value),
  };
  // Days that had crewSize matching the old default were using default, not an override.
  // Set them to null so they inherit the new default.
  const oldDefault = plan.defaultCrewSize;
  const workCalendar =
    oldDefault != null
      ? next.workCalendar.map((day) =>
          day.crewSize === oldDefault ? { ...day, crewSize: null as number | null } : day,
        )
      : next.workCalendar;
  return {
    ...next,
    workCalendar: reconcileWorkCalendar(
      workCalendar,
      next.eventStartDate,
      next.eventEndDate,
      next.defaultCrewSize,
    ),
  };
}

export function updatePlanCalendarDay(
  plan: Plan,
  date: string,
  updates: Partial<WorkCalendarDay>,
): Plan {
  return {
    ...plan,
    workCalendar: plan.workCalendar.map((day) =>
      day.date === date ? { ...day, ...updates } : day,
    ),
  };
}

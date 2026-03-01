import type { Plan, WorkCalendarDay } from '../plan-model';
import { updatePlanLineItem } from '../plan-model';
import type { ScheduleSpan } from './assignment';
import { reconcileWorkCalendar, listDateRange } from './work-calendar';

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

/**
 * Apply a schedule span change to a line item, managing crewByDate lifecycle:
 * - When span extends: initialize crewByDate for new dates with item.crew.
 * - When span shrinks: prune crewByDate entries outside new span.
 * - When unscheduled (null span): clear crewByDate entirely.
 */
export function updateLineItemAssignment(
  plan: Plan,
  lineItemId: string,
  nextSpan: ScheduleSpan,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  if (!nextSpan.scheduledStart || !nextSpan.scheduledEnd) {
    return updatePlanLineItem(plan, lineItemId, {
      scheduledStart: null,
      scheduledEnd: null,
      crewByDate: undefined,
    });
  }

  const newDates = new Set(listDateRange(nextSpan.scheduledStart, nextSpan.scheduledEnd));
  const existingCrewByDate = item.crewByDate ?? {};

  const nextCrewByDate: Record<string, number> = {};
  for (const date of newDates) {
    nextCrewByDate[date] = existingCrewByDate[date] ?? item.crew;
  }

  return updatePlanLineItem(plan, lineItemId, {
    scheduledStart: nextSpan.scheduledStart,
    scheduledEnd: nextSpan.scheduledEnd,
    crewByDate: nextCrewByDate,
  });
}

/**
 * Update crew count for a specific line item on a specific date.
 */
export function updateLineItemCrewForDate(
  plan: Plan,
  lineItemId: string,
  date: string,
  crew: number,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  const crewByDate = { ...(item.crewByDate ?? {}), [date]: Math.max(0, Math.floor(crew)) };
  return updatePlanLineItem(plan, lineItemId, { crewByDate });
}

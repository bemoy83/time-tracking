import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPlanEffectiveSpan, updatePlanLineItem } from '../plan-model';
import type { ScheduleSpan } from './assignment';
import { reconcileWorkCalendar, listDateRange } from './work-calendar';
import type { PhaseDateField } from './schedule-span';

export function normalizeDefaultCrewSize(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function reconcilePlanCalendar(plan: Plan): Plan {
  const effectiveSpan = getPlanEffectiveSpan(plan);
  return {
    ...plan,
    workCalendar: reconcileWorkCalendar(
      plan.workCalendar,
      effectiveSpan?.start ?? null,
      effectiveSpan?.end ?? null,
      plan.defaultCrewSize,
    ),
  };
}

export function setPlanEventDate(
  plan: Plan,
  field: 'eventStartDate' | 'eventEndDate',
  value: string,
): Plan {
  return reconcilePlanCalendar({
    ...plan,
    [field]: value || null,
  });
}

export function setPlanPhaseDate(
  plan: Plan,
  field: PhaseDateField,
  value: string,
): Plan {
  return reconcilePlanCalendar({
    ...plan,
    [field]: value || null,
  });
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
  return reconcilePlanCalendar({
    ...next,
    workCalendar,
  });
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

  const allDates = listDateRange(nextSpan.scheduledStart, nextSpan.scheduledEnd);
  const workDaySet =
    plan.workCalendar.length > 0
      ? new Set(plan.workCalendar.filter((d) => d.isWorkDay).map((d) => d.date))
      : null;
  const newDates = new Set(
    workDaySet ? allDates.filter((d) => workDaySet.has(d)) : allDates,
  );
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
 * Non-work days are never stored; if date is non-work, its entry is removed from crewByDate.
 */
export function updateLineItemCrewForDate(
  plan: Plan,
  lineItemId: string,
  date: string,
  crew: number,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  const isWorkDay =
    plan.workCalendar.length > 0
      ? plan.workCalendar.some((d) => d.date === date && d.isWorkDay)
      : true;
  const existing = { ...(item.crewByDate ?? {}) };
  if (isWorkDay) {
    existing[date] = Math.max(0, Math.floor(crew));
  } else {
    delete existing[date];
  }
  const crewByDate = Object.keys(existing).length > 0 ? existing : undefined;
  return updatePlanLineItem(plan, lineItemId, { crewByDate });
}

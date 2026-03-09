import type { BuildPhase } from '../../types';
import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPhaseFields, getPlanEffectiveSpan, phaseFieldUpdates, updatePlanLineItem } from '../plan-model';
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
 * Sync a calendar day change from the shared crew pool into a plan's workCalendar.
 * Used when the user toggles work/off in the shared schedule -- the change must
 * propagate to each plan so mutations (assignment, crew) persist correctly.
 * Only updates plans whose effective span includes the date.
 */
export function syncPlanWorkCalendarFromCrewPool(
  plan: Plan,
  date: string,
  updates: Partial<WorkCalendarDay>,
): Plan {
  const span = getPlanEffectiveSpan(plan);
  if (!span || date < span.start || date > span.end) return plan;

  const existingDay = plan.workCalendar.find((d) => d.date === date);
  const overrideDay: WorkCalendarDay = existingDay
    ? { ...existingDay, ...updates, date }
    : {
        date,
        isWorkDay: updates.isWorkDay ?? true,
        accessStart: updates.accessStart ?? '08:00',
        accessEnd: updates.accessEnd ?? '16:00',
        crewSize: updates.crewSize ?? null,
      };

  const existingOverride = existingDay
    ? plan.workCalendar.map((d) => (d.date === date ? overrideDay : d))
    : [...plan.workCalendar, overrideDay];

  const workCalendar = reconcileWorkCalendar(
    existingOverride,
    span.start,
    span.end,
    plan.defaultCrewSize,
  );

  return { ...plan, workCalendar };
}

/**
 * Sync the full crew pool calendar to a plan's workCalendar.
 * Used when the global default crew changes -- all work days get the crew pool's
 * effective crew (day.crewSize ?? crewPoolDefaultCrewSize) so the global default
 * overrides any locally set crew on the plan.
 */
export function syncCrewPoolCalendarToPlan(
  plan: Plan,
  crewPoolCalendar: WorkCalendarDay[],
  crewPoolDefaultCrewSize: number,
): Plan {
  const span = getPlanEffectiveSpan(plan);
  if (!span) return plan;

  let result = plan;
  for (const day of crewPoolCalendar) {
    if (day.date < span.start || day.date > span.end) continue;
    const effectiveCrew = day.crewSize ?? crewPoolDefaultCrewSize;
    result = syncPlanWorkCalendarFromCrewPool(result, day.date, {
      isWorkDay: day.isWorkDay,
      accessStart: day.accessStart ?? undefined,
      accessEnd: day.accessEnd ?? undefined,
      crewSize: day.isWorkDay ? effectiveCrew : null,
    });
  }
  return result;
}

/**
 * Apply a schedule span change to a line item for a specific phase,
 * managing crewByDate lifecycle:
 * - When span extends: initialize crewByDate for new dates with phase crew.
 * - When span shrinks: prune crewByDate entries outside new span.
 * - When unscheduled (null span): clear crewByDate entirely.
 */
export function updateLineItemAssignment(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  nextSpan: ScheduleSpan,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  const pf = getPhaseFields(item, phase);

  if (!nextSpan.scheduledStart || !nextSpan.scheduledEnd) {
    return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
      scheduledStart: null,
      scheduledEnd: null,
      crewByDate: undefined,
    }));
  }

  const allDates = listDateRange(nextSpan.scheduledStart, nextSpan.scheduledEnd);
  const workDaySet =
    plan.workCalendar.length > 0
      ? new Set(plan.workCalendar.filter((d) => d.isWorkDay).map((d) => d.date))
      : null;
  const newDates = new Set(
    workDaySet ? allDates.filter((d) => workDaySet.has(d)) : allDates,
  );
  const existingCrewByDate = pf.crewByDate ?? {};

  const nextCrewByDate: Record<string, number> = {};
  for (const date of newDates) {
    nextCrewByDate[date] = existingCrewByDate[date] ?? pf.crew;
  }

  return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
    scheduledStart: nextSpan.scheduledStart,
    scheduledEnd: nextSpan.scheduledEnd,
    crewByDate: nextCrewByDate,
  }));
}

/**
 * Update crew count for a specific line item on a specific date for a specific phase.
 * Non-work days are never stored; if date is non-work, its entry is removed from crewByDate.
 */
export function updateLineItemCrewForDate(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
  crew: number,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  const pf = getPhaseFields(item, phase);

  const isWorkDay =
    plan.workCalendar.length > 0
      ? plan.workCalendar.some((d) => d.date === date && d.isWorkDay)
      : true;
  const existing = { ...(pf.crewByDate ?? {}) };
  if (isWorkDay) {
    existing[date] = Math.max(0, Math.floor(crew));
  } else {
    delete existing[date];
  }
  const crewByDate = Object.keys(existing).length > 0 ? existing : undefined;
  return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, { crewByDate }));
}

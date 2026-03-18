import type { BuildPhase, Project } from '../../types';
import type { DailyEffortMap, PhaseFields, Plan, WorkCalendarDay } from '../plan-model';
import {
  getPhaseFields,
  normalizeDailyEffortMap,
  normalizePlanEfficiency,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
  updatePlanLineItem,
} from '../plan-model';
import type { ScheduleSpan } from './assignment';
import { dayAccessHours, listDateRange, reconcileWorkCalendarForSpans } from './work-calendar';
import {
  getWorkCalendarPhaseSpans,
  isDateWithinAnySpan,
  readPhaseDateValues,
  type PhaseDateField,
} from './schedule-span';

/**
 * Build a normalized effort map for work days within a span using preferred crew
 * as a default chunking heuristic.
 */
export function buildDefaultPersonHoursByDate(
  pf: Pick<PhaseFields, 'scheduledStart' | 'scheduledEnd' | 'personHoursByDate' | 'crew'>,
  workCalendar: WorkCalendarDay[],
): DailyEffortMap | undefined {
  if (pf.personHoursByDate) return pf.personHoursByDate;
  if (!pf.scheduledStart || !pf.scheduledEnd) return undefined;

  const allDates = listDateRange(pf.scheduledStart, pf.scheduledEnd);
  const dayByDate = new Map(workCalendar.map((day) => [day.date, day]));
  const migrated: DailyEffortMap = {};
  for (const date of allDates) {
    const day = dayByDate.get(date);
    if (day && !day.isWorkDay) continue;
    const accessHours = day ? dayAccessHours(day) : 8;
    const defaultHours = Number(Math.max(accessHours * Math.max(pf.crew, 1), 0.01).toFixed(2));
    migrated[date] = defaultHours;
  }
  return normalizeDailyEffortMap(migrated);
}

export function normalizeDefaultCrewSize(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function reconcilePlanCalendar(plan: Plan): Plan {
  const spans = getWorkCalendarPhaseSpans(readPhaseDateValues(plan));
  return {
    ...plan,
    workCalendar: reconcileWorkCalendarForSpans(
      plan.workCalendar,
      spans,
      plan.defaultCrewSize,
    ),
  };
}

export function applyProjectPhaseDatesToPlan(plan: Plan, project: Project): Plan {
  const next: Plan = {
    ...plan,
    assemblyStartDate: project.assemblyStartDate ?? null,
    assemblyEndDate: project.assemblyEndDate ?? null,
    dismantleStartDate: project.dismantleStartDate ?? null,
    dismantleEndDate: project.dismantleEndDate ?? null,
    eventStartDate: project.eventStartDate ?? null,
    eventEndDate: project.eventEndDate ?? null,
  };
  return reconcilePlanCalendar(next);
}

export function setPlanEventDate(
  plan: Plan,
  field: 'eventStartDate' | 'eventEndDate',
  value: string,
): Plan {
  return {
    ...plan,
    [field]: value || null,
  };
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

export function setPlanDefaultEfficiency(plan: Plan, value: string): Plan {
  const pct = parseFloat(value);
  const decimal = Number.isFinite(pct) && value !== ''
    ? normalizePlanEfficiency(pct / 100) ?? null
    : null;
  return { ...plan, defaultEfficiency: decimal };
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
 * Only updates plans whose phase windows include the date.
 */
export function syncPlanWorkCalendarFromCrewPool(
  plan: Plan,
  date: string,
  updates: Partial<WorkCalendarDay>,
): Plan {
  const spans = getWorkCalendarPhaseSpans(readPhaseDateValues(plan));
  if (!isDateWithinAnySpan(date, spans)) return plan;

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

  const workCalendar = reconcileWorkCalendarForSpans(
    existingOverride,
    spans,
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
  const spans = getWorkCalendarPhaseSpans(readPhaseDateValues(plan));
  if (spans.length === 0) return plan;

  let result = plan;
  for (const day of crewPoolCalendar) {
    if (!isDateWithinAnySpan(day.date, spans)) continue;
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
 * managing personHoursByDate lifecycle:
 * - When span extends: initialize new work days using preferred daily effort.
 * - When span shrinks: prune entries outside new span.
 * - When unscheduled (null span): clear personHoursByDate entirely.
 */
export function updateLineItemAssignment(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  nextSpan: ScheduleSpan,
  togglePersonHoursByDate?: DailyEffortMap | undefined,
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  if (!nextSpan.scheduledStart || !nextSpan.scheduledEnd) {
    return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
      scheduledStart: null,
      scheduledEnd: null,
      personHoursByDate: undefined,
    }));
  }

  // When personHoursByDate is provided directly from toggle, use it as-is
  if (togglePersonHoursByDate !== undefined) {
    const normalized = normalizeDailyEffortMap(togglePersonHoursByDate);
    const span = recomputeScheduledSpanFromEffortMap(normalized);
    return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
      scheduledStart: span.scheduledStart,
      scheduledEnd: span.scheduledEnd,
      personHoursByDate: normalized,
    }));
  }

  const pf = getPhaseFields(item, phase);
  const allDates = listDateRange(nextSpan.scheduledStart, nextSpan.scheduledEnd);
  const dayByDate = new Map(plan.workCalendar.map((day) => [day.date, day]));
  const nextPersonHoursByDate: DailyEffortMap = {};
  const existing = pf.personHoursByDate ?? {};
  for (const date of allDates) {
    const day = dayByDate.get(date);
    if (day && !day.isWorkDay) continue;
    const accessHours = day ? dayAccessHours(day) : 8;
    const defaultHours = Number(Math.max(accessHours * Math.max(pf.crew, 1), 0.01).toFixed(2));
    nextPersonHoursByDate[date] = existing[date] ?? defaultHours;
  }

  const normalized = normalizeDailyEffortMap(nextPersonHoursByDate);
  const span = recomputeScheduledSpanFromEffortMap(normalized);
  return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
    scheduledStart: span.scheduledStart,
    scheduledEnd: span.scheduledEnd,
    personHoursByDate: normalized,
  }));
}

/**
 * Update planned effort for a specific line item on a specific date for a specific phase.
 * Non-work days are never stored; if date is non-work, its entry is removed.
 *
 * @param workDayCalendarOverride - When provided (e.g. shared schedule crew pool), use this
 * for the work-day check instead of plan.workCalendar. Allows crew changes on days the
 * shared calendar marks as work days even when the plan's calendar has not been synced.
 */
export function updateLineItemPersonHoursForDate(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
  personHours: number,
  workDayCalendarOverride?: WorkCalendarDay[],
): Plan {
  const item = plan.lineItems.find((i) => i.id === lineItemId);
  if (!item) return plan;

  const pf = getPhaseFields(item, phase);

  const calendar =
    workDayCalendarOverride && workDayCalendarOverride.length > 0
      ? workDayCalendarOverride
      : plan.workCalendar;
  const isWorkDay =
    calendar.length > 0 ? calendar.some((d) => d.date === date && d.isWorkDay) : true;

  const existing = { ...(pf.personHoursByDate ?? {}) };
  if (!isWorkDay || personHours <= 0) {
    delete existing[date];
  } else {
    existing[date] = Number(personHours.toFixed(2));
  }
  const personHoursByDate = normalizeDailyEffortMap(existing);
  const span = recomputeScheduledSpanFromEffortMap(personHoursByDate);
  return updatePlanLineItem(plan, lineItemId, phaseFieldUpdates(phase, {
    personHoursByDate,
    scheduledStart: span.scheduledStart,
    scheduledEnd: span.scheduledEnd,
  }));
}

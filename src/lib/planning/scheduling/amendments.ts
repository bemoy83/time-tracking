import type { BuildPhase } from '../../types';
import type { DailyEffortMap, Plan, PlanLineItem } from '../plan-model';
import {
  getPhaseFields,
  normalizeDailyEffortMap,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
} from '../plan-model';
import { nowUtc } from '../../types';
import { dayAccessHours, listDateRange } from './work-calendar';

export interface BulkScheduleAmendmentChange {
  lineItemId: string;
  phase: BuildPhase;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

function sameEffortMap(
  a: DailyEffortMap | undefined,
  b: DailyEffortMap | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Math.abs((left[key] ?? 0) - (right[key] ?? 0)) <= 0.01);
}

function didScheduleChange(
  previous: { scheduledStart: string | null; scheduledEnd: string | null },
  next: { scheduledStart: string | null; scheduledEnd: string | null },
): boolean {
  return previous.scheduledStart !== next.scheduledStart || previous.scheduledEnd !== next.scheduledEnd;
}

export function applyScheduleAmendment(
  plan: Plan,
  lineItem: PlanLineItem,
  phase: BuildPhase,
  nextScheduledStart: string | null,
  nextScheduledEnd: string | null,
  amendmentNote: string | null,
  overridePersonHoursByDate?: DailyEffortMap | undefined,
): Plan {
  const pf = getPhaseFields(lineItem, phase);
  let nextPersonHoursByDate: DailyEffortMap | undefined = pf.personHoursByDate;

  if (overridePersonHoursByDate !== undefined) {
    nextPersonHoursByDate = normalizeDailyEffortMap(overridePersonHoursByDate);
  } else if (nextScheduledStart && nextScheduledEnd) {
    const allDates = listDateRange(nextScheduledStart, nextScheduledEnd);
    const dayByDate = new Map(plan.workCalendar.map((day) => [day.date, day]));
    const existing = pf.personHoursByDate ?? {};
    const updated: DailyEffortMap = {};
    for (const date of allDates) {
      const day = dayByDate.get(date);
      if (day && !day.isWorkDay) continue;
      const accessHours = day ? dayAccessHours(day) : 8;
      updated[date] = existing[date] ?? Number((Math.max(pf.crew, 1) * accessHours).toFixed(2));
    }
    nextPersonHoursByDate = normalizeDailyEffortMap(updated);
  } else {
    nextPersonHoursByDate = undefined;
  }

  const span = recomputeScheduledSpanFromEffortMap(nextPersonHoursByDate);
  const effortChanged = !sameEffortMap(pf.personHoursByDate, nextPersonHoursByDate);
  const spanChanged = didScheduleChange(
    { scheduledStart: pf.scheduledStart, scheduledEnd: pf.scheduledEnd },
    { scheduledStart: span.scheduledStart, scheduledEnd: span.scheduledEnd },
  );

  if (
    !spanChanged &&
    !effortChanged &&
    (amendmentNote ?? null) === (lineItem.amendmentNote ?? null)
  ) {
    return plan;
  }

  const updatedAt = nowUtc();

  return {
    ...plan,
    updatedAt,
    lineItems: plan.lineItems.map((item) => {
      if (item.id !== lineItem.id) return item;
      if (!spanChanged && !effortChanged) {
        return {
          ...item,
          amendmentNote: amendmentNote?.trim() || null,
        };
      }

      const phaseUpdates = phaseFieldUpdates(phase, {
        originalScheduledStart: spanChanged ? (pf.originalScheduledStart ?? pf.scheduledStart) : pf.originalScheduledStart,
        originalScheduledEnd: spanChanged ? (pf.originalScheduledEnd ?? pf.scheduledEnd) : pf.originalScheduledEnd,
        scheduledStart: span.scheduledStart,
        scheduledEnd: span.scheduledEnd,
        personHoursByDate: nextPersonHoursByDate,
      });

      return {
        ...item,
        ...phaseUpdates,
        amendmentNote: amendmentNote?.trim() || null,
        amendedAt: updatedAt,
      };
    }),
  };
}

/**
 * Apply a single amendment note/timestamp for a batch assistant run.
 * Preserves the schedule/personHoursByDate already computed in `nextPlan`.
 */
export function applyBulkScheduleAmendment(
  previousPlan: Plan,
  nextPlan: Plan,
  changes: BulkScheduleAmendmentChange[],
  amendmentNote: string,
): Plan {
  const note = amendmentNote.trim();
  if (note.length === 0 || changes.length === 0) return nextPlan;

  const changedByItem = new Map<string, Set<BuildPhase>>();
  for (const change of changes) {
    const existing = changedByItem.get(change.lineItemId) ?? new Set<BuildPhase>();
    existing.add(change.phase);
    changedByItem.set(change.lineItemId, existing);
  }

  const previousByItem = new Map(previousPlan.lineItems.map((item) => [item.id, item]));
  const updatedAt = nowUtc();

  return {
    ...nextPlan,
    updatedAt,
    lineItems: nextPlan.lineItems.map((item) => {
      const changedPhases = changedByItem.get(item.id);
      if (!changedPhases || changedPhases.size === 0) return item;

      const previousItem = previousByItem.get(item.id) ?? item;
      let updates: Partial<PlanLineItem> = {};

      for (const phase of changedPhases) {
        const previousPf = getPhaseFields(previousItem, phase);
        const nextPf = getPhaseFields(item, phase);
        updates = {
          ...updates,
          ...phaseFieldUpdates(phase, {
            originalScheduledStart: previousPf.originalScheduledStart ?? previousPf.scheduledStart,
            originalScheduledEnd: previousPf.originalScheduledEnd ?? previousPf.scheduledEnd,
            scheduledStart: nextPf.scheduledStart,
            scheduledEnd: nextPf.scheduledEnd,
            personHoursByDate: nextPf.personHoursByDate,
          }),
        };
      }

      return {
        ...item,
        ...updates,
        amendmentNote: note,
        amendedAt: updatedAt,
      };
    }),
  };
}

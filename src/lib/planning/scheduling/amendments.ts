import type { BuildPhase } from '../../types';
import type { Plan, PlanLineItem } from '../plan-model';
import { getPhaseFields, phaseFieldUpdates } from '../plan-model';
import { nowUtc } from '../../types';
import { listDateRange } from './work-calendar';

export interface BulkScheduleAmendmentChange {
  lineItemId: string;
  phase: BuildPhase;
  scheduledStart: string | null;
  scheduledEnd: string | null;
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
  overrideCrewByDate?: Record<string, number> | undefined,
): Plan {
  const pf = getPhaseFields(lineItem, phase);

  if (
    pf.scheduledStart === nextScheduledStart &&
    pf.scheduledEnd === nextScheduledEnd &&
    (amendmentNote ?? null) === (lineItem.amendmentNote ?? null)
  ) {
    return plan;
  }

  const changed = didScheduleChange(
    { scheduledStart: pf.scheduledStart, scheduledEnd: pf.scheduledEnd },
    { scheduledStart: nextScheduledStart, scheduledEnd: nextScheduledEnd },
  );

  const updatedAt = nowUtc();

  return {
    ...plan,
    updatedAt,
    lineItems: plan.lineItems.map((item) => {
      if (item.id !== lineItem.id) return item;
      if (!changed) {
        return {
          ...item,
          amendmentNote: amendmentNote?.trim() || null,
        };
      }

      // Update crewByDate when span changes — only store work days to avoid orphaned non-work entries
      let nextCrewByDate: Record<string, number> | undefined = pf.crewByDate;
      if (overrideCrewByDate !== undefined) {
        nextCrewByDate = overrideCrewByDate;
      } else if (nextScheduledStart && nextScheduledEnd) {
        const allDates = listDateRange(nextScheduledStart, nextScheduledEnd);
        const workDaySet =
          plan.workCalendar.length > 0
            ? new Set(plan.workCalendar.filter((d) => d.isWorkDay).map((d) => d.date))
            : null;
        const newDates = workDaySet
          ? allDates.filter((d) => workDaySet.has(d))
          : allDates;
        const existing = pf.crewByDate ?? {};
        const updated: Record<string, number> = {};
        for (const date of newDates) {
          updated[date] = existing[date] ?? pf.crew;
        }
        nextCrewByDate = updated;
      } else {
        nextCrewByDate = undefined;
      }

      const phaseUpdates = phaseFieldUpdates(phase, {
        originalScheduledStart: pf.originalScheduledStart ?? pf.scheduledStart,
        originalScheduledEnd: pf.originalScheduledEnd ?? pf.scheduledEnd,
        scheduledStart: nextScheduledStart,
        scheduledEnd: nextScheduledEnd,
        crewByDate: nextCrewByDate,
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
 * Preserves the schedule/crewByDate already computed in `nextPlan`.
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
            crewByDate: nextPf.crewByDate,
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

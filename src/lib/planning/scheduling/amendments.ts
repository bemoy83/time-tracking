import type { BuildPhase } from '../../types';
import type { Plan, PlanLineItem } from '../plan-model';
import { getPhaseFields, phaseFieldUpdates } from '../plan-model';
import { nowUtc } from '../../types';
import { listDateRange } from './work-calendar';

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
      let nextCrewByDate = pf.crewByDate;
      if (nextScheduledStart && nextScheduledEnd) {
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

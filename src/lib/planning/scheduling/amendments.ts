import type { Plan, PlanLineItem } from '../plan-model';
import { nowUtc } from '../../types';
import { listDateRange } from './work-calendar';

function didScheduleChange(
  previous: Pick<PlanLineItem, 'scheduledStart' | 'scheduledEnd'>,
  next: Pick<PlanLineItem, 'scheduledStart' | 'scheduledEnd'>,
): boolean {
  return previous.scheduledStart !== next.scheduledStart || previous.scheduledEnd !== next.scheduledEnd;
}

export function applyScheduleAmendment(
  plan: Plan,
  lineItem: PlanLineItem,
  nextScheduledStart: string | null,
  nextScheduledEnd: string | null,
  amendmentNote: string | null,
): Plan {
  if (
    lineItem.scheduledStart === nextScheduledStart &&
    lineItem.scheduledEnd === nextScheduledEnd &&
    (amendmentNote ?? null) === (lineItem.amendmentNote ?? null)
  ) {
    return plan;
  }

  const changed = didScheduleChange(
    { scheduledStart: lineItem.scheduledStart, scheduledEnd: lineItem.scheduledEnd },
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
      let nextCrewByDate = item.crewByDate;
      if (nextScheduledStart && nextScheduledEnd) {
        const allDates = listDateRange(nextScheduledStart, nextScheduledEnd);
        const workDaySet =
          plan.workCalendar.length > 0
            ? new Set(plan.workCalendar.filter((d) => d.isWorkDay).map((d) => d.date))
            : null;
        const newDates = workDaySet
          ? allDates.filter((d) => workDaySet.has(d))
          : allDates;
        const existing = item.crewByDate ?? {};
        const updated: Record<string, number> = {};
        for (const date of newDates) {
          updated[date] = existing[date] ?? item.crew;
        }
        nextCrewByDate = updated;
      } else {
        nextCrewByDate = undefined;
      }

      return {
        ...item,
        originalScheduledStart: item.originalScheduledStart ?? item.scheduledStart,
        originalScheduledEnd: item.originalScheduledEnd ?? item.scheduledEnd,
        scheduledStart: nextScheduledStart,
        scheduledEnd: nextScheduledEnd,
        crewByDate: nextCrewByDate,
        amendmentNote: amendmentNote?.trim() || null,
        amendedAt: updatedAt,
      };
    }),
  };
}

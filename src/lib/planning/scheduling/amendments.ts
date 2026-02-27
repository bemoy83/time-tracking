import type { Plan, PlanLineItem } from '../plan-model';
import { nowUtc } from '../../types';

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

      return {
        ...item,
        originalScheduledStart: item.originalScheduledStart ?? item.scheduledStart,
        originalScheduledEnd: item.originalScheduledEnd ?? item.scheduledEnd,
        scheduledStart: nextScheduledStart,
        scheduledEnd: nextScheduledEnd,
        amendmentNote: amendmentNote?.trim() || null,
        amendedAt: updatedAt,
      };
    }),
  };
}

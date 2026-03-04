import { isPlanArchived } from '../plan-lifecycle';
import type { Plan } from '../plan-model';
import { toggleAssignmentDate } from './assignment';
import { applyScheduleAmendment } from './amendments';
import { updateLineItemAssignment, updateLineItemCrewForDate } from './plan-schedule-update';

export function toggleSharedAssignment(
  plan: Plan,
  lineItemId: string,
  date: string,
): Plan {
  if (isPlanArchived(plan)) return plan;

  const lineItem = plan.lineItems.find((item) => item.id === lineItemId);
  if (!lineItem) return plan;

  const nextSpan = toggleAssignmentDate(lineItem, date);
  if (plan.status === 'active') {
    return applyScheduleAmendment(
      plan,
      lineItem,
      nextSpan.scheduledStart,
      nextSpan.scheduledEnd,
      null,
    );
  }

  return updateLineItemAssignment(plan, lineItemId, nextSpan);
}

export function setSharedCrewForDate(
  plan: Plan,
  lineItemId: string,
  date: string,
  crew: number,
): Plan {
  if (isPlanArchived(plan)) return plan;
  return updateLineItemCrewForDate(plan, lineItemId, date, crew);
}

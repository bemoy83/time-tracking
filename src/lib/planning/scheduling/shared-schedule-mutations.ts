import type { BuildPhase } from '../../types';
import { isPlanArchived } from '../plan-lifecycle';
import type { Plan } from '../plan-model';
import { getPhaseFields } from '../plan-model';
import { toggleAssignmentDate } from './assignment';
import { applyScheduleAmendment } from './amendments';
import { updateLineItemAssignment, updateLineItemCrewForDate } from './plan-schedule-update';

export function toggleSharedAssignment(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
): Plan {
  if (isPlanArchived(plan)) return plan;

  const lineItem = plan.lineItems.find((item) => item.id === lineItemId);
  if (!lineItem) return plan;

  const pf = getPhaseFields(lineItem, phase);
  const nextSpan = toggleAssignmentDate(pf, date);
  if (plan.status === 'active') {
    return applyScheduleAmendment(
      plan,
      lineItem,
      phase,
      nextSpan.scheduledStart,
      nextSpan.scheduledEnd,
      null,
    );
  }

  return updateLineItemAssignment(plan, lineItemId, phase, nextSpan);
}

export function setSharedCrewForDate(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
  crew: number,
): Plan {
  if (isPlanArchived(plan)) return plan;
  return updateLineItemCrewForDate(plan, lineItemId, phase, date, crew);
}

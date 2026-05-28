import type { BuildPhase } from '../../types';
import { isPlanArchived } from '../plan-lifecycle';
import type { Plan } from '../plan-model';
import { getPhaseFields } from '../plan-model';
import { resolveDefaultPersonHoursForAssignment, toggleAssignmentDate } from './assignment';
import { applyScheduleAmendment } from './amendments';
import { resolveRequiredPersonHoursForPhase } from './auto-schedule';
import { dayAccessHours } from './work-calendar';
import { updateLineItemAssignment, updateLineItemPersonHoursForDate } from './plan-schedule-update';

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
  const day = plan.workCalendar.find((candidate) => candidate.date === date);
  if (day && !day.isWorkDay) return plan;
  const accessHours = day ? dayAccessHours(day) : 8;
  const requiredPH = resolveRequiredPersonHoursForPhase(lineItem, phase) ?? 0;
  const scheduledPH = Object.values(pf.personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0);
  const preferredDayPH = accessHours * Math.max(pf.crew, 1);
  const defaultPersonHours = resolveDefaultPersonHoursForAssignment(
    requiredPH,
    scheduledPH,
    preferredDayPH,
  );
  const result = toggleAssignmentDate({ personHoursByDate: pf.personHoursByDate }, date, defaultPersonHours);

  if (plan.status === 'active') {
    return applyScheduleAmendment(
      plan,
      lineItem,
      phase,
      result.span.scheduledStart,
      result.span.scheduledEnd,
      null,
      result.personHoursByDate,
    );
  }

  return updateLineItemAssignment(plan, lineItemId, phase, result.span, result.personHoursByDate);
}

export function setSharedPersonHoursForDate(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
  personHours: number,
): Plan {
  if (isPlanArchived(plan)) return plan;

  const lineItem = plan.lineItems.find((item) => item.id === lineItemId);
  if (!lineItem) return plan;

  const nextPlan = updateLineItemPersonHoursForDate(plan, lineItemId, phase, date, personHours);
  if (nextPlan === plan) return plan;

  if (plan.status === 'active') {
    const nextLineItem = nextPlan.lineItems.find((item) => item.id === lineItemId) ?? lineItem;
    const nextPf = getPhaseFields(nextLineItem, phase);
    return applyScheduleAmendment(
      plan,
      lineItem,
      phase,
      nextPf.scheduledStart,
      nextPf.scheduledEnd,
      null,
      nextPf.personHoursByDate,
    );
  }

  return nextPlan;
}

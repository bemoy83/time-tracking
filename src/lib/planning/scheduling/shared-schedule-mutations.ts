import type { BuildPhase } from '../../types';
import { isPlanArchived } from '../plan-lifecycle';
import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPhaseFields } from '../plan-model';
import { toggleAssignmentDate } from './assignment';
import { lazyMigrateCrewByDate } from './plan-schedule-update';
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
  const migrated = lazyMigrateCrewByDate(pf, plan.workCalendar);
  const result = toggleAssignmentDate({ ...pf, crewByDate: migrated }, date);

  if (plan.status === 'active') {
    return applyScheduleAmendment(
      plan,
      lineItem,
      phase,
      result.span.scheduledStart,
      result.span.scheduledEnd,
      null,
      result.crewByDate,
    );
  }

  return updateLineItemAssignment(plan, lineItemId, phase, result.span, result.crewByDate);
}

export function setSharedCrewForDate(
  plan: Plan,
  lineItemId: string,
  phase: BuildPhase,
  date: string,
  crew: number,
  /** Crew pool calendar; when provided, used for work-day check instead of plan.workCalendar. */
  workDayCalendar?: WorkCalendarDay[],
): Plan {
  if (isPlanArchived(plan)) return plan;
  return updateLineItemCrewForDate(plan, lineItemId, phase, date, crew, workDayCalendar);
}

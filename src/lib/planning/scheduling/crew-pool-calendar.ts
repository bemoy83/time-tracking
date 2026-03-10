import type { Plan, WorkCalendarDay } from '../plan-model';
import { getWorkCalendarPhaseSpans, readPhaseDateValues } from './schedule-span';
import {
  generateDefaultWorkCalendarForSpans,
  reconcileWorkCalendarForSpans,
} from './work-calendar';

interface CrewPoolCalendarOptions {
  defaultCrewSize?: number | null;
  existingCalendar?: WorkCalendarDay[];
}

export function deriveCrewPoolDefaultCrewSize(plans: Plan[]): number {
  return plans.reduce((maxCrew, plan) => {
    const crew = plan.defaultCrewSize ?? 0;
    return Math.max(maxCrew, crew);
  }, 0);
}

export function deriveCrewPoolCalendar(
  plans: Plan[],
  options: CrewPoolCalendarOptions = {},
): WorkCalendarDay[] {
  const spans = plans.flatMap((plan) =>
    getWorkCalendarPhaseSpans(readPhaseDateValues(plan)),
  );

  if (spans.length === 0) return [];

  const defaultCrewSize = options.defaultCrewSize ?? deriveCrewPoolDefaultCrewSize(plans);

  if (options.existingCalendar && options.existingCalendar.length > 0) {
    return reconcileWorkCalendarForSpans(options.existingCalendar, spans, defaultCrewSize);
  }

  return generateDefaultWorkCalendarForSpans(spans, defaultCrewSize);
}

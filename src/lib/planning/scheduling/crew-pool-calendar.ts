import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPlanEffectiveSpan } from '../plan-model';
import { generateDefaultWorkCalendar, reconcileWorkCalendar } from './work-calendar';

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
  const spans = plans
    .map((plan) => getPlanEffectiveSpan(plan))
    .filter((span): span is { start: string; end: string } => span != null);

  if (spans.length === 0) return [];

  const start = spans.reduce((minStart, span) => (span.start < minStart ? span.start : minStart), spans[0].start);
  const end = spans.reduce((maxEnd, span) => (span.end > maxEnd ? span.end : maxEnd), spans[0].end);
  const defaultCrewSize = options.defaultCrewSize ?? deriveCrewPoolDefaultCrewSize(plans);

  if (options.existingCalendar && options.existingCalendar.length > 0) {
    return reconcileWorkCalendar(options.existingCalendar, start, end, defaultCrewSize);
  }

  return generateDefaultWorkCalendar(start, end, defaultCrewSize);
}

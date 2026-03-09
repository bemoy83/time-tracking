import { getAssignedDates } from '../../../../lib/planning/scheduling/assignment';
import { getEffectiveCrewForDate, getPhaseFields, type PlanLineItem } from '../../../../lib/planning/plan-model';
import type { BuildPhase } from '../../../../lib/types';
import type { PhaseDateValues } from '../schedule-date-ui';
import { getPhaseRange, hasCompletePhaseDates, isDateWithinSpan } from '../schedule-date-ui';

/**
 * Compute work hours this line item contributes to a specific day (sequential fill).
 * Returns 0 when not assigned or day has no capacity.
 */
export function getWorkHoursForDay(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
  assignedDatesOverride?: string[],
): number {
  const pf = getPhaseFields(item, phase);
  const assignedDates = assignedDatesOverride ?? getAssignedDates(pf);
  if (!assignedDates.includes(date)) return 0;
  const totalPersonHours = pf.timeHours * pf.crew;
  let remaining = totalPersonHours;
  for (const d of assignedDates) {
    const day = dayByDate.get(d);
    const accessH = day?.accessHours ?? 0;
    if (accessH <= 0) continue;
    const crew = getEffectiveCrewForDate(item, phase, d);
    const capacity = crew * accessH;
    const work = Math.min(remaining, capacity);
    if (d === date) return Math.round(work * 10) / 10;
    remaining -= work;
  }
  return 0;
}

/**
 * Compute scheduled person-hours for a line item: sum of crew x accessHours
 * for each assigned work day. Counts all allocated capacity, not capped at estimate.
 * Returns 0 when no assignments.
 */
export function getScheduledHours(
  item: PlanLineItem,
  phase: BuildPhase,
  assignedDates: string[],
  dayByDate: Map<string, { accessHours: number }>,
): number {
  if (assignedDates.length === 0) return 0;
  let total = 0;
  for (const date of assignedDates) {
    const day = dayByDate.get(date);
    const accessH = day?.accessHours ?? 0;
    if (accessH <= 0) continue;
    const crew = getEffectiveCrewForDate(item, phase, date);
    total += crew * accessH;
  }
  return Math.round(total * 10) / 10;
}

/**
 * On the item's last assigned day with crew, returns { assignedPersonHours, remainingAtStart, deficit? } --
 * assigned person-hours this day (crew x accessHours, not capped) and estimate remaining at start.
 * remainingAtStart = amount still needed at start of this day (same for over or under).
 * deficit = amount still needed after this day, when over-worker.
 */
export function getLastDayBreakdown(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
  assignedDatesOverride?: string[],
): { assignedPersonHours: number; remainingAtStart: number; deficit?: number } | null {
  const pf = getPhaseFields(item, phase);
  const assignedDates = assignedDatesOverride ?? getAssignedDates(pf);
  if (assignedDates.length === 0) return null;
  if (assignedDates[assignedDates.length - 1] !== date) return null;

  const day = dayByDate.get(date);
  const accessH = day?.accessHours ?? 0;
  if (accessH <= 0) return null;
  const crew = getEffectiveCrewForDate(item, phase, date);
  const assignedPersonHours = Math.round(crew * accessH * 10) / 10;
  if (assignedPersonHours <= 0) return null;

  const totalPersonHours = pf.timeHours * pf.crew;
  let remaining = totalPersonHours;
  let remainingAtStart = 0;

  for (const d of assignedDates) {
    const dDay = dayByDate.get(d);
    const dAccessH = dDay?.accessHours ?? 0;
    if (dAccessH <= 0) continue;
    const dCrew = getEffectiveCrewForDate(item, phase, d);
    const capacity = dCrew * dAccessH;
    if (d === date) remainingAtStart = remaining;
    remaining -= Math.min(remaining, capacity);
  }

  const result: { assignedPersonHours: number; remainingAtStart: number; deficit?: number } = {
    assignedPersonHours,
    remainingAtStart: Math.round(remainingAtStart * 10) / 10,
  };
  if (remaining > 0.01) result.deficit = Math.round(remaining * 10) / 10;
  return result;
}

/** For isOverWorker check: true when last day has deficit. */
export function isOverWorkerForDay(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
  assignedDatesOverride?: string[],
): boolean {
  const b = getLastDayBreakdown(item, phase, date, dayByDate, assignedDatesOverride);
  return b != null && b.deficit != null;
}

export function isOverTargetCell(
  breakdown: { assignedPersonHours: number; remainingAtStart: number; deficit?: number } | null,
  tolerance = 1.05,
): boolean {
  return breakdown != null
    && breakdown.deficit == null
    && breakdown.remainingAtStart > 0
    && breakdown.assignedPersonHours > breakdown.remainingAtStart * tolerance;
}

export function getAssignedDatesWithinPhase(
  item: PlanLineItem,
  phase: BuildPhase,
  phaseDates: PhaseDateValues | undefined,
): string[] {
  const pf = getPhaseFields(item, phase);
  const all = getAssignedDates(pf);
  if (!phaseDates || !hasCompletePhaseDates(phaseDates)) return all;
  const span = getPhaseRange(phaseDates, phase);
  if (!span) return all;
  return all.filter((date) => isDateWithinSpan(date, span));
}

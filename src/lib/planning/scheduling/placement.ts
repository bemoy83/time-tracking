/**
 * Shared placement primitives for the single-plan and shared-schedule auto-schedulers.
 *
 * Both schedulers share the same DayState shape, Placement result, and core
 * simulatePlacement algorithm. buildDayStates accepts a pre-built committed map
 * so callers control what counts as already-scheduled work.
 */

import type { WorkCalendarDay, DailyEffortMap } from '../plan-model';
import { normalizeDailyEffortMap } from '../plan-model';
import { dayAccessHours, dayEffectiveAvailablePersonHours } from './work-calendar';
import { round2 } from './capacity-math';

export interface DayState {
  date: string;
  /** Raw access hours (accessEnd - accessStart). Used as the per-day chunking unit. */
  accessHours: number;
  /** Effective person-hours still available for scheduling on this day. */
  remainingPersonHours: number;
}

export interface Placement {
  assignedPH: number;
  personHoursByDate: DailyEffortMap;
}

/**
 * Build day states from a work calendar and a map of already-committed person-hours.
 *
 * @param calendar       Full work calendar (off days are filtered out).
 * @param defaultCrewSize Plan-level crew size fallback.
 * @param planEfficiency  Plan-level efficiency; per-day overrides handled inside dayEffectiveAvailablePersonHours.
 * @param committed       date → person-hours already scheduled (subtracted from available).
 */
export function buildDayStates(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
  planEfficiency: number,
  committed: Map<string, number>,
): DayState[] {
  return calendar
    .filter((day) => day.isWorkDay)
    .map((day) => {
      const available = dayEffectiveAvailablePersonHours(day, defaultCrewSize, planEfficiency);
      return {
        date: day.date,
        accessHours: dayAccessHours(day),
        remainingPersonHours: round2(available - (committed.get(day.date) ?? 0)),
      };
    });
}

/**
 * Greedily place requiredPH person-hours across candidate days.
 *
 * preferredDayTarget = preferredCrew × accessHours (raw, not effective).
 * This is a chunking hint only — remainingPersonHours (effective capacity) is always
 * the binding constraint, so over-placement is not possible even when preferredDayTarget
 * exceeds effective capacity.
 *
 * Returns null if no person-hours could be placed at all.
 */
export function simulatePlacement(
  candidates: DayState[],
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
): Placement | null {
  const personHoursByDate: DailyEffortMap = {};
  let assignedPH = 0;

  for (const day of candidates) {
    if (assignedPH >= requiredPH - 0.01) break;
    const preferredDayTarget = Math.max(preferredCrew, 1) * day.accessHours;
    const availablePH = allowOverAllocation
      ? Math.max(day.remainingPersonHours, preferredDayTarget)
      : day.remainingPersonHours;
    const assignablePH = Math.min(requiredPH - assignedPH, availablePH, preferredDayTarget);
    if (assignablePH <= 0.01) continue;
    personHoursByDate[day.date] = round2(assignablePH);
    assignedPH += assignablePH;
  }

  const normalized = normalizeDailyEffortMap(personHoursByDate);
  if (!normalized) return null;
  return { assignedPH: round2(assignedPH), personHoursByDate: normalized };
}

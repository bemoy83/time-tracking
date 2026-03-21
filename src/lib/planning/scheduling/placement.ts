/**
 * Shared placement primitives for the single-plan and shared-schedule auto-schedulers.
 *
 * Both schedulers share the same DayState shape, Placement result, and core
 * simulatePlacement algorithm. buildDayStates accepts a pre-built committed map
 * so callers control what counts as already-scheduled work.
 */

import type { WorkCalendarDay, DailyEffortMap } from '../plan-model';
import { normalizeDailyEffortMap } from '../plan-model';
import { dayAccessHours, dayEffectiveAvailablePersonHours, resolveDayEfficiency } from './work-calendar';
import { round2 } from './capacity-math';

export interface DayState {
  date: string;
  /** Raw access hours (accessEnd - accessStart). Used as the per-day chunking unit. */
  accessHours: number;
  /** Effective person-hours still available for scheduling on this day. */
  remainingPersonHours: number;
  /**
   * Per-skill effective person-hours remaining on this day.
   * tagId → effective PH remaining (skill headcount × accessHours × efficiency − committed).
   * Only populated when a CrewPool is passed to buildDayStates.
   */
  skillPersonHoursRemaining?: Map<string, number>;
}

export interface Placement {
  assignedPH: number;
  personHoursByDate: DailyEffortMap;
}

/**
 * Build day states from a work calendar and a map of already-committed person-hours.
 *
 * @param calendar         Full work calendar (off days are filtered out).
 * @param defaultCrewSize  Plan-level crew size fallback.
 * @param planEfficiency   Plan-level efficiency; per-day overrides handled inside dayEffectiveAvailablePersonHours.
 * @param committed        date → person-hours already scheduled (subtracted from available).
 * @param crewPool         Optional system-level skill crew allocations (tagId → headcount).
 *                         When provided, each DayState gains skillPersonHoursRemaining.
 *                         A day's crewComposition overrides the system pool for that day.
 * @param skillCommitted   Optional per-skill committed hours (tagId → date → PH).
 *                         Subtracted from the initial skillPersonHoursRemaining per day.
 */
export function buildDayStates(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
  planEfficiency: number,
  committed: Map<string, number>,
  crewPool?: Record<string, number>,
  skillCommitted?: Map<string, Map<string, number>>,
): DayState[] {
  return calendar
    .filter((day) => day.isWorkDay)
    .map((day) => {
      const available = dayEffectiveAvailablePersonHours(day, defaultCrewSize, planEfficiency);
      const accessHours = dayAccessHours(day);
      const efficiency = resolveDayEfficiency(day, planEfficiency);

      let skillPersonHoursRemaining: Map<string, number> | undefined;
      const effectivePool = day.crewComposition ?? crewPool;
      if (effectivePool && Object.keys(effectivePool).length > 0) {
        skillPersonHoursRemaining = new Map();
        for (const [tagId, count] of Object.entries(effectivePool)) {
          const skillPH = round2(count * accessHours * efficiency);
          const alreadyCommitted = skillCommitted?.get(tagId)?.get(day.date) ?? 0;
          skillPersonHoursRemaining.set(tagId, round2(Math.max(0, skillPH - alreadyCommitted)));
        }
      }

      return {
        date: day.date,
        accessHours,
        remainingPersonHours: round2(available - (committed.get(day.date) ?? 0)),
        skillPersonHoursRemaining,
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
 * When skillTagId is provided, placement is also constrained by the day's
 * skillPersonHoursRemaining for that skill. Both pools are reduced after each assignment.
 *
 * Returns null if no person-hours could be placed at all.
 */
export function simulatePlacement(
  candidates: DayState[],
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
  skillTagId?: string,
): Placement | null {
  const personHoursByDate: DailyEffortMap = {};
  let assignedPH = 0;

  for (const day of candidates) {
    if (assignedPH >= requiredPH - 0.01) break;
    const preferredDayTarget = Math.max(preferredCrew, 1) * day.accessHours;
    const baseAvailablePH = allowOverAllocation
      ? Math.max(day.remainingPersonHours, preferredDayTarget)
      : day.remainingPersonHours;

    // Skill constraint: when a skill tag is required, cap by available skill PH.
    // This applies even in allowOverAllocation mode — you cannot conjure more skilled workers.
    const skillAvailablePH = (skillTagId && day.skillPersonHoursRemaining)
      ? (day.skillPersonHoursRemaining.get(skillTagId) ?? 0)
      : Infinity;

    const availablePH = Math.min(baseAvailablePH, skillAvailablePH);
    const assignablePH = Math.min(requiredPH - assignedPH, availablePH, preferredDayTarget);
    if (assignablePH <= 0.01) continue;
    personHoursByDate[day.date] = round2(assignablePH);
    assignedPH += assignablePH;

    // Reduce skill pool alongside the aggregate pool
    if (skillTagId && day.skillPersonHoursRemaining) {
      day.skillPersonHoursRemaining.set(
        skillTagId,
        round2((day.skillPersonHoursRemaining.get(skillTagId) ?? 0) - assignablePH),
      );
    }
  }

  const normalized = normalizeDailyEffortMap(personHoursByDate);
  if (!normalized) return null;
  return { assignedPH: round2(assignedPH), personHoursByDate: normalized };
}

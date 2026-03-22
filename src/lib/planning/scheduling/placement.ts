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
   * Base effective person-hours for this day before fragmentation and committed subtraction.
   * Used to recompute remainingPersonHours when the fragmentation factor changes during scheduling.
   */
  baseEffectivePersonHours: number;
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
const DEFAULT_TASK_SWITCHING_FACTOR = 0.95;

/**
 * Compute the fragmentation penalty factor for a given day.
 *
 * Counts distinct skill groups with committed hours on this date.
 * If there are any committed hours not accounted for by skill groups
 * (i.e. untagged items), adds one generic group to the count.
 *
 * fragmentationFactor = baseFactor ^ max(0, skillGroupCount - 1)
 */
/**
 * Count the number of distinct skill groups with committed work on a given date.
 * Each skill tag with committed hours is one group; untagged work adds one generic group.
 * Returns 1 when there is no fragmentation (single group or no committed work).
 */
export function resolveSkillGroupCount(
  date: string,
  committed: Map<string, number>,
  skillCommitted: Map<string, Map<string, number>> | undefined,
): number {
  const totalCommitted = committed.get(date) ?? 0;
  if (totalCommitted <= 0.01 || !skillCommitted) return 1;

  let skillGroupCount = 0;
  let totalSkillCommitted = 0;
  for (const [, dateMap] of skillCommitted) {
    const hours = dateMap.get(date) ?? 0;
    if (hours > 0.01) {
      skillGroupCount += 1;
      totalSkillCommitted += hours;
    }
  }
  if (totalCommitted - totalSkillCommitted > 0.01) skillGroupCount += 1;
  return Math.max(1, skillGroupCount);
}

export function resolveFragmentationFactor(
  date: string,
  committed: Map<string, number>,
  skillCommitted: Map<string, Map<string, number>> | undefined,
  taskSwitchingFactor: number,
): number {
  const groupCount = resolveSkillGroupCount(date, committed, skillCommitted);
  if (groupCount <= 1) return 1;
  return Math.pow(taskSwitchingFactor, groupCount - 1);
}

export function buildDayStates(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
  planEfficiency: number,
  committed: Map<string, number>,
  crewPool?: Record<string, number>,
  skillCommitted?: Map<string, Map<string, number>>,
  taskSwitchingFactor?: number | null,
): DayState[] {
  const baseFactor = taskSwitchingFactor ?? DEFAULT_TASK_SWITCHING_FACTOR;

  return calendar
    .filter((day) => day.isWorkDay)
    .map((day) => {
      const available = dayEffectiveAvailablePersonHours(day, defaultCrewSize, planEfficiency);
      const accessHours = dayAccessHours(day);
      const efficiency = resolveDayEfficiency(day, planEfficiency);
      const fragmentationFactor = resolveFragmentationFactor(day.date, committed, skillCommitted, baseFactor);

      let skillPersonHoursRemaining: Map<string, number> | undefined;
      const effectivePool = day.crewComposition ?? crewPool;
      if (effectivePool && Object.keys(effectivePool).length > 0) {
        skillPersonHoursRemaining = new Map();
        for (const [tagId, count] of Object.entries(effectivePool)) {
          const skillPH = round2(count * accessHours * efficiency * fragmentationFactor);
          const alreadyCommitted = skillCommitted?.get(tagId)?.get(day.date) ?? 0;
          skillPersonHoursRemaining.set(tagId, round2(Math.max(0, skillPH - alreadyCommitted)));
        }
      }

      return {
        date: day.date,
        accessHours,
        baseEffectivePersonHours: available,
        remainingPersonHours: round2((available * fragmentationFactor) - (committed.get(day.date) ?? 0)),
        skillPersonHoursRemaining,
      };
    });
}

/**
 * Recompute a day's remainingPersonHours after a new placement has been recorded
 * in the live committed/skillCommitted maps. Call this after updating those maps.
 */
export function recomputeDayRemaining(
  day: DayState,
  date: string,
  liveCommitted: Map<string, number>,
  liveSkillCommitted: Map<string, Map<string, number>> | undefined,
  taskSwitchingFactor: number,
): void {
  const newFF = resolveFragmentationFactor(date, liveCommitted, liveSkillCommitted, taskSwitchingFactor);
  const totalCommitted = liveCommitted.get(date) ?? 0;
  day.remainingPersonHours = round2(day.baseEffectivePersonHours * newFF - totalCommitted);
}

/**
 * Compute the available person-hours cap for a prospective placement that may introduce
 * a new skill group (or the untagged group) to a day.
 *
 * When an item would be the FIRST representative of its skill (or the first untagged item)
 * on a given day, the fragmentation factor will increase after placement. We pre-apply
 * the post-placement factor so the placement stays within the penalized usable hours.
 *
 * Returns Infinity when no new group would be added (no prospective constraint needed).
 */
function computeProspectiveCap(
  day: DayState,
  skillTagId: string | undefined,
  liveCommitted: Map<string, number>,
  liveSkillCommitted: Map<string, Map<string, number>>,
  taskSwitchingFactor: number,
): number {
  const totalNow = liveCommitted.get(day.date) ?? 0;

  // Count existing skill groups on this day
  let groups = 0;
  let totalSkillNow = 0;
  for (const [, dm] of liveSkillCommitted) {
    const h = dm.get(day.date) ?? 0;
    if (h > 0.01) { groups++; totalSkillNow += h; }
  }
  const hasUntagged = totalNow - totalSkillNow > 0.01;
  if (hasUntagged) groups++;

  // Would this placement add a new group?
  let wouldAddGroup: boolean;
  if (skillTagId) {
    wouldAddGroup = (liveSkillCommitted.get(skillTagId)?.get(day.date) ?? 0) <= 0.01;
  } else {
    // Untagged: adds the untagged group only if it's not already present and there are skill groups
    wouldAddGroup = !hasUntagged && groups > 0;
  }

  if (!wouldAddGroup) return Infinity;

  const newGroups = groups + 1;
  if (newGroups <= 1) return Infinity; // single group → no fragmentation penalty
  const prospectiveFF = Math.pow(taskSwitchingFactor, newGroups - 1);
  return Math.max(0, round2(day.baseEffectivePersonHours * prospectiveFF - totalNow));
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
 * When liveCommitted / liveSkillCommitted are provided, a prospective fragmentation cap
 * is applied: if this placement would introduce a new skill group (or the untagged group)
 * to a day, the available capacity is pre-limited to the post-fragmentation headroom.
 * This prevents the last item on a day from exceeding usable hours.
 *
 * Returns null if no person-hours could be placed at all.
 */
export function simulatePlacement(
  candidates: DayState[],
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
  skillTagId?: string,
  liveCommitted?: Map<string, number>,
  liveSkillCommitted?: Map<string, Map<string, number>>,
  taskSwitchingFactor?: number,
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

    // Prospective fragmentation cap: if this item would introduce a new skill group
    // (or the untagged group) to this day, limit placement to post-fragmentation headroom.
    const prospectiveCap = (liveCommitted && liveSkillCommitted)
      ? computeProspectiveCap(day, skillTagId, liveCommitted, liveSkillCommitted, taskSwitchingFactor ?? DEFAULT_TASK_SWITCHING_FACTOR)
      : Infinity;

    const availablePH = Math.min(baseAvailablePH, skillAvailablePH, prospectiveCap);
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

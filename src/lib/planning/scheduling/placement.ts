/**
 * Shared placement primitives for the single-plan and shared-schedule auto-schedulers.
 *
 * Both schedulers share the same DayState shape, Placement result, and core
 * simulatePlacement algorithm. buildDayStates accepts a pre-built committed map
 * so callers control what counts as already-scheduled work.
 *
 * DayState is the single authoritative view of a work-day during scheduling.
 * recomputeDayRemaining is the only place that advances its committed state.
 */

import type { WorkCalendarDay, DailyEffortMap } from '../plan-model';
import { normalizeDailyEffortMap } from '../plan-model';
import {
  dayAccessHours,
  dayCrewSize,
  dayEffectiveAvailablePersonHours,
  resolveDayEfficiency,
} from './work-calendar';
import { round2 } from './capacity-math';

export interface DayState {
  date: string;
  /** Raw access hours (accessEnd - accessStart). Used as the per-day chunking unit. */
  accessHours: number;
  /** Effective person-hours still available for scheduling on this day. */
  remainingPersonHours: number;
  /**
   * Base effective person-hours for this day before over-subscription penalty and committed subtraction.
   * Used to recompute remainingPersonHours when the penalty changes during scheduling.
   */
  baseEffectivePersonHours: number;
  /**
   * Per-skill physical capacity remaining on this day.
   * tagId → crew × accessHours × efficiency − committed (physical constraint, no penalty factor).
   * Only populated when a crewPool is passed to buildDayStates.
   */
  skillPersonHoursRemaining?: Map<string, number>;
  /**
   * Per-skill committed person-hours on this day.
   * tagId → hours placed so far. Used for incremental required-crew computation in recomputeDayRemaining.
   * Only populated when a crewPool is passed to buildDayStates.
   */
  committedSkillPHByTag?: Map<string, number>;
  /** Physical crew headcount available on this day. */
  availableCrew: number;
  /**
   * Snapshot of per-skill headcounts active on this day (day.crewComposition ?? crewPool).
   * Used to compute over-subscription penalty.
   */
  skillCrewAllocations?: Record<string, number>;
  /** Running total of person-hours committed on this day. Updated by recomputeDayRemaining. */
  committedPersonHours: number;
  /** Portion of committedPersonHours attributable to named skill tags. */
  committedSkillPersonHours: number;
  /** Skill tag IDs with any committed hours today. Drives the prospective-cap alreadyPresent check. */
  activeSkillTagIds: Set<string>;
  /** Cached required-crew sum; updated incrementally by recomputeDayRemaining. */
  currentRequiredSkillCrew: number;
}

export interface Placement {
  assignedPH: number;
  personHoursByDate: DailyEffortMap;
}

const DEFAULT_TASK_SWITCHING_FACTOR = 0.95;

// ─── Crew over-subscription model ────────────────────────────────────────────

/**
 * Compute the total worker-days required by all committed work on a given date.
 *
 * For each skill tag with committed hours > 0.01 on `date`:
 *   requiredCrew += ceil(skillHours / accessHours)
 * For untagged committed hours:
 *   requiredCrew += ceil(untaggedPH / accessHours)
 *
 * When the sum exceeds availableCrew, workers must cover more than one skill type.
 * Returns 0 when no skill/crew data is available (no-penalty fallback).
 */
export function resolveRequiredSkillCrew(
  date: string,
  accessHours: number,
  committed: Map<string, number>,
  skillCommitted: Map<string, Map<string, number>> | undefined,
  skillCrewAllocations: Record<string, number> | undefined,
): number {
  if (!skillCommitted || !skillCrewAllocations || accessHours <= 0) return 0;
  const totalCommitted = committed.get(date) ?? 0;
  if (totalCommitted <= 0.01) return 0;

  let requiredCrew = 0;
  let totalSkillCommitted = 0;
  for (const [, dateMap] of skillCommitted) {
    const hours = dateMap.get(date) ?? 0;
    if (hours > 0.01) {
      requiredCrew += Math.ceil(hours / accessHours);
      totalSkillCommitted += hours;
    }
  }

  const untaggedPH = totalCommitted - totalSkillCommitted;
  if (untaggedPH > 0.01) {
    requiredCrew += Math.ceil(untaggedPH / accessHours);
  }

  return requiredCrew;
}

/**
 * Compute the crew over-subscription penalty factor for a given day.
 *
 * When the sum of required skill headcounts exceeds available crew, workers must cover
 * multiple skill types. The penalty scales with the degree of over-subscription:
 *
 *   overSubMultiple = max(0, requiredSkillCrew - availableCrew)   (switching workers count)
 *   factor = taskSwitchingFactor ^ overSubMultiple
 *
 * Returns 1.0 (no penalty) when:
 *   - skillCrewAllocations is absent or empty (no crew pool configured)
 *   - availableCrew <= 0
 *   - requiredSkillCrew <= availableCrew (no over-subscription)
 */
export function resolveOverSubscriptionFactor(
  date: string,
  accessHours: number,
  availableCrew: number,
  committed: Map<string, number>,
  skillCommitted: Map<string, Map<string, number>> | undefined,
  skillCrewAllocations: Record<string, number> | undefined,
  taskSwitchingFactor: number,
): number {
  if (!skillCrewAllocations || Object.keys(skillCrewAllocations).length === 0 || availableCrew <= 0) return 1;
  const requiredCrew = resolveRequiredSkillCrew(date, accessHours, committed, skillCommitted, skillCrewAllocations);
  if (requiredCrew <= availableCrew) return 1;
  const overSubMultiple = requiredCrew - availableCrew;
  return Math.pow(taskSwitchingFactor, overSubMultiple);
}

// ─── Committed accumulation helpers ──────────────────────────────────────────

/**
 * Accumulate person-hours entries into an aggregate committed map.
 * Callers iterate their line items and call this for each day's hours.
 */
export function accumulateCommitted(
  entries: Iterable<[string, number]>,
  into: Map<string, number>,
): void {
  for (const [date, hours] of entries) {
    into.set(date, (into.get(date) ?? 0) + hours);
  }
}

/**
 * Accumulate person-hours entries into a per-skill committed map.
 */
export function accumulateSkillCommitted(
  entries: Iterable<[string, number]>,
  skillTagId: string,
  into: Map<string, Map<string, number>>,
): void {
  let dateMap = into.get(skillTagId);
  if (!dateMap) { dateMap = new Map(); into.set(skillTagId, dateMap); }
  for (const [date, hours] of entries) {
    dateMap.set(date, (dateMap.get(date) ?? 0) + hours);
  }
}

// ─── Core scheduling primitives ───────────────────────────────────────────────

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
      const availableCrew = dayCrewSize(day, defaultCrewSize);
      const effectivePool = day.crewComposition ?? crewPool;

      const overSubFactor = resolveOverSubscriptionFactor(
        day.date, accessHours, availableCrew,
        committed, skillCommitted, effectivePool, baseFactor,
      );

      // Per-skill: physical constraint only — no overSubFactor.
      // The aggregate penalty belongs in remainingPersonHours.
      let skillPersonHoursRemaining: Map<string, number> | undefined;
      if (effectivePool && Object.keys(effectivePool).length > 0) {
        skillPersonHoursRemaining = new Map();
        for (const [tagId, count] of Object.entries(effectivePool)) {
          const skillPH = round2(count * accessHours * efficiency);
          const alreadyCommitted = skillCommitted?.get(tagId)?.get(day.date) ?? 0;
          skillPersonHoursRemaining.set(tagId, round2(Math.max(0, skillPH - alreadyCommitted)));
        }
      }

      // Populate committed state fields
      const committedPH = committed.get(day.date) ?? 0;
      const activeSkillTagIds = new Set<string>();
      let committedSkillPH = 0;
      let committedSkillPHByTag: Map<string, number> | undefined;
      if (effectivePool && Object.keys(effectivePool).length > 0) {
        committedSkillPHByTag = new Map();
      }
      if (skillCommitted) {
        for (const [tagId, dateMap] of skillCommitted) {
          const hours = dateMap.get(day.date) ?? 0;
          if (hours > 0.01) {
            activeSkillTagIds.add(tagId);
            committedSkillPH += hours;
            committedSkillPHByTag?.set(tagId, hours);
          }
        }
      }

      return {
        date: day.date,
        accessHours,
        availableCrew,
        skillCrewAllocations: effectivePool,
        baseEffectivePersonHours: available,
        remainingPersonHours: round2((available * overSubFactor) - committedPH),
        skillPersonHoursRemaining,
        committedSkillPHByTag,
        committedPersonHours: committedPH,
        committedSkillPersonHours: round2(committedSkillPH),
        activeSkillTagIds,
        currentRequiredSkillCrew: resolveRequiredSkillCrew(
          day.date, accessHours, committed, skillCommitted, effectivePool,
        ),
      };
    });
}

/**
 * Advance a day's committed state after a placement has been recorded.
 * Updates committedPersonHours, committedSkillPersonHours, activeSkillTagIds,
 * currentRequiredSkillCrew, and remainingPersonHours atomically.
 */
export function recomputeDayRemaining(
  day: DayState,
  placedHours: number,
  skillTagId: string | undefined,
  taskSwitchingFactor: number,
): void {
  const oldCommittedPH = day.committedPersonHours;
  day.committedPersonHours += placedHours;

  if (skillTagId) {
    day.committedSkillPersonHours += placedHours;
    day.activeSkillTagIds.add(skillTagId);
    if (day.committedSkillPHByTag) {
      const oldPH = day.committedSkillPHByTag.get(skillTagId) ?? 0;
      const newPH = oldPH + placedHours;
      day.committedSkillPHByTag.set(skillTagId, newPH);
      const oldRequired = oldPH > 0.01 ? Math.ceil(oldPH / day.accessHours) : 0;
      const newRequired = Math.ceil(newPH / day.accessHours);
      day.currentRequiredSkillCrew += newRequired - oldRequired;
    }
  } else {
    // Untagged: update the crew contribution by delta
    const oldUntaggedPH = oldCommittedPH - day.committedSkillPersonHours;
    const newUntaggedPH = day.committedPersonHours - day.committedSkillPersonHours;
    const oldCrew = oldUntaggedPH > 0.01 ? Math.ceil(oldUntaggedPH / day.accessHours) : 0;
    const newCrew = newUntaggedPH > 0.01 ? Math.ceil(newUntaggedPH / day.accessHours) : 0;
    day.currentRequiredSkillCrew += newCrew - oldCrew;
  }

  // Derive FF from updated currentRequiredSkillCrew
  let ff = 1;
  if (
    day.skillCrewAllocations
    && Object.keys(day.skillCrewAllocations).length > 0
    && day.availableCrew > 0
    && day.currentRequiredSkillCrew > day.availableCrew
  ) {
    const overSub = day.currentRequiredSkillCrew - day.availableCrew;
    ff = Math.pow(taskSwitchingFactor, overSub);
  }
  day.remainingPersonHours = round2(day.baseEffectivePersonHours * ff - day.committedPersonHours);
}

/**
 * Compute the available person-hours cap for a prospective placement that may increase
 * crew over-subscription on a day.
 *
 * When a skill (or untagged group) has no committed hours yet on this day, placing work
 * for it would add its headcount to currentRequiredSkillCrew. If this pushes over
 * availableCrew, the over-subscription factor worsens. We pre-apply the post-placement
 * factor as a cap so the placement stays within the penalized usable hours.
 *
 * Returns Infinity when the placement would not change the over-subscription level.
 */
function computeProspectiveCap(
  day: DayState,
  skillTagId: string | undefined,
  taskSwitchingFactor: number,
): number {
  if (!day.skillCrewAllocations || Object.keys(day.skillCrewAllocations).length === 0 || day.availableCrew <= 0) return Infinity;

  const alreadyPresent = skillTagId
    ? day.activeSkillTagIds.has(skillTagId)
    : (day.committedPersonHours - day.committedSkillPersonHours > 0.01);

  if (alreadyPresent) return Infinity;

  // Conservative estimate: assume remaining capacity would be filled with this new skill.
  // ceil(remaining / accessHours) is the max extra required workers; minimum is 1.
  const extraCrew = day.accessHours > 0
    ? Math.max(1, Math.ceil(day.remainingPersonHours / day.accessHours))
    : 1;

  const prospectiveRequired = day.currentRequiredSkillCrew + extraCrew;
  if (prospectiveRequired <= day.availableCrew) return Infinity;

  const newOverSub = prospectiveRequired - day.availableCrew;
  const prospectiveFF = Math.pow(taskSwitchingFactor, newOverSub);

  const currentFF = day.currentRequiredSkillCrew <= day.availableCrew
    ? 1
    : Math.pow(taskSwitchingFactor, day.currentRequiredSkillCrew - day.availableCrew);

  if (Math.abs(prospectiveFF - currentFF) < 0.0001) return Infinity;

  return Math.max(0, round2(day.baseEffectivePersonHours * prospectiveFF - day.committedPersonHours));
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
 * skillPersonHoursRemaining for that skill (physical cap). Both pools are reduced after
 * each assignment.
 *
 * A prospective over-subscription cap is always applied: if this placement would introduce
 * a new skill (or untagged group) to a day and push crew over-subscription higher, the
 * available capacity is pre-limited to the post-placement headroom. This prevents the last
 * item on a day from exceeding usable hours.
 *
 * Returns null if no person-hours could be placed at all.
 */
export function simulatePlacement(
  candidates: DayState[],
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
  skillTagId?: string,
  taskSwitchingFactor?: number,
): Placement | null {
  const tsf = taskSwitchingFactor ?? DEFAULT_TASK_SWITCHING_FACTOR;
  const personHoursByDate: DailyEffortMap = {};
  let assignedPH = 0;

  for (const day of candidates) {
    if (assignedPH >= requiredPH - 0.01) break;
    const preferredDayTarget = Math.max(preferredCrew, 1) * day.accessHours;
    const baseAvailablePH = allowOverAllocation
      ? Math.max(day.remainingPersonHours, preferredDayTarget)
      : day.remainingPersonHours;

    // Skill constraint: physical cap — you cannot conjure more skilled workers.
    // Applies even in allowOverAllocation mode.
    const skillAvailablePH = (skillTagId && day.skillPersonHoursRemaining)
      ? (day.skillPersonHoursRemaining.get(skillTagId) ?? 0)
      : Infinity;

    // Prospective over-subscription cap: if this item would introduce a new skill (or
    // untagged group) and push crew over-subscription higher, pre-limit to post-placement headroom.
    const prospectiveCap = computeProspectiveCap(day, skillTagId, tsf);

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

/**
 * Shared capacity math primitives.
 *
 * Single source of truth for round2, sameEffortMap, effectiveAccessHours
 * resolution, and crew-equivalent conversion. All scheduling and display
 * layers import from here rather than re-implementing these inline.
 */

import type { BuildPhase } from '../../types';
import type { PlanLineItem, DailyEffortMap } from '../plan-model';
import { getPlannedPersonHoursForDate } from '../plan-model';

export function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function sameEffortMap(
  a: DailyEffortMap | undefined,
  b: DailyEffortMap | undefined,
): boolean {
  const aKeys = Object.keys(a ?? {}).sort();
  const bKeys = Object.keys(b ?? {}).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if ((a ?? {})[aKeys[i]!] !== (b ?? {})[bKeys[i]!]) return false;
  }
  return true;
}

/**
 * Resolve effective access hours per worker for a day.
 *
 * Converts between person-hours and crew-equivalent:
 *   crewEquivalent = personHours / effectiveAccessHours
 *
 * effectiveAccessHours = effectiveAvailablePersonHours / availableCrew
 *   = accessHours × dayEfficiency
 *
 * At full effective utilization (51.2h placed on an 8-crew, 80%-efficiency day),
 * this correctly yields 8/8 crew rather than 6.4/8.
 */
export function resolveEffectiveAccessHours(
  effectiveAvailablePersonHours: number,
  availableCrew: number,
  accessHours: number,
): number {
  return availableCrew > 0
    ? effectiveAvailablePersonHours / availableCrew
    : accessHours || 8;
}

/**
 * Convert assigned person-hours on a date to crew-equivalent.
 * Moved from plan-model.ts — this is a scheduling/display concern.
 */
export function getCrewEquivalentForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
  accessHours: number,
): number {
  if (accessHours <= 0) return 0;
  return round2(getPlannedPersonHoursForDate(item, phase, date) / accessHours);
}

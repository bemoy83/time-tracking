/**
 * Shared productivity calculator logic.
 * Pure functions for solving crew size or time from work quantity and rate.
 *
 * Used by CalculatorSheet (full calculator UI) and CreateTaskSheet (inline suggest).
 */

export type SolveFor = 'crew' | 'time';

export interface ProductivityResult {
  crew?: number;
  crewExact?: number;
  estimatedMinutes?: number;
  timeHours?: number;
}

/**
 * Compute crew or time from quantity, rate, and the known variable.
 *
 * - solveFor 'crew': returns ceil(qty / (timeHours × rate)) — needs timeHours > 0
 * - solveFor 'time': returns round((qty / (crew × rate)) × 60) in minutes — needs crew > 0
 *
 * Returns null when any guard fails (rate/qty/divisor ≤ 0).
 */
export function computeProductivityResult(
  solveFor: SolveFor,
  qty: number,
  rate: number,
  timeHours: number,
  crew: number,
): ProductivityResult | null {
  if (rate <= 0 || qty <= 0) return null;

  if (solveFor === 'crew') {
    if (timeHours <= 0) return null;
    const crewExact = qty / (timeHours * rate);
    return { crew: Math.ceil(crewExact), crewExact };
  }

  // solveFor === 'time'
  if (crew <= 0) return null;
  const hours = qty / (crew * rate);
  return {
    estimatedMinutes: Math.round(hours * 60),
    timeHours: hours,
  };
}

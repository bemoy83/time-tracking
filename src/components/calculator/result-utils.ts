import type { ConfidenceLevel } from '../../lib/kpi';
import { computeProductivityResult, type SolveFor } from '../../lib/calculator';
import { type WorkUnit, formatDurationShort } from '../../lib/types';
import type { CalcResult, ProductivitySource } from './types';

export function computeResult(
  solveFor: SolveFor,
  qty: number,
  rate: number,
  rateSource: ProductivitySource,
  workUnit: WorkUnit,
  timeHours: number,
  crew: number,
  confidence: ConfidenceLevel | null,
  sampleCount: number | null,
): CalcResult | null {
  const raw = computeProductivityResult(solveFor, qty, rate, timeHours, crew);
  if (!raw) return null;

  const base = { rateUsed: rate, rateSource, quantityUsed: qty, unitUsed: workUnit, confidence, sampleCount };

  if (solveFor === 'crew') {
    return { type: 'crew', crewValue: raw.crew, crewExact: raw.crewExact, ...base };
  }
  const ms = (raw.timeHours ?? 0) * 3_600_000;
  return { type: 'time', timeFormatted: formatDurationShort(ms), timeHours: raw.timeHours, ...base };
}

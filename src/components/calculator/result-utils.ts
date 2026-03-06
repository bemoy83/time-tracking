import type { ConfidenceLevel } from '../../lib/kpi';
import { computeProductivityResult, type SolveFor } from '../../lib/calculator';
import { type WorkUnit, formatDurationShort } from '../../lib/types';
import type { ScenarioComputed } from '../../lib/calculator-scenarios';
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

export function toCalcResult(computed: ScenarioComputed | null): CalcResult | null {
  if (!computed || !computed.isValid) return null;
  if (computed.resultType == null || computed.rateUsed == null || computed.rateSource == null || computed.quantityUsed == null) {
    return null;
  }

  if (computed.resultType === 'crew') {
    return {
      type: 'crew',
      crewValue: computed.crewValue ?? undefined,
      crewExact: computed.crewExact ?? undefined,
      rateUsed: computed.rateUsed,
      rateSource: computed.rateSource,
      quantityUsed: computed.quantityUsed,
      unitUsed: computed.workUnit,
      confidence: computed.confidence,
      sampleCount: computed.sampleCount,
    };
  }

  const timeHours = computed.timeHours ?? (computed.estimatedMinutes != null ? computed.estimatedMinutes / 60 : undefined);
  return {
    type: 'time',
    timeHours,
    timeFormatted: timeHours != null ? formatDurationShort(timeHours * 3_600_000) : undefined,
    rateUsed: computed.rateUsed,
    rateSource: computed.rateSource,
    quantityUsed: computed.quantityUsed,
    unitUsed: computed.workUnit,
    confidence: computed.confidence,
    sampleCount: computed.sampleCount,
  };
}

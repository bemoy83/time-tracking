/**
 * KPI-backed suggestions for plan line items.
 *
 * Looks up matching WorkTypeKpi data and attaches per-phase recommendations:
 * - Suggested productivity rate (from historical data)
 * - Recommended crew and time estimates
 * - Confidence level and risk flags
 */

import type { WorkTypeKpi } from '../kpi';
import { findKpiByKey, type ConfidenceLevel } from '../kpi';
import type { BuildPhase } from '../types';
import {
  getPhaseSpan,
  getPhaseFields,
  getPhaseQuantity,
  type Plan,
  type PlanLineItem,
} from './plan-model';
import { lineItemWorkTypeKey } from '../work-package-core';
import { dayAccessHours, generateDefaultWorkCalendar } from './scheduling/work-calendar';

/** Risk flag thresholds. */
const HIGH_CV_THRESHOLD = 0.4;

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface PhaseSuggestion {
  /** Suggested productivity rate from historical data. */
  suggestedRate: number | null;
  /** Recommended time (hours) based on suggested rate and item's quantity/crew. */
  suggestedTimeHours: number | null;
  /** Suggested minimum crew size for the scheduled phase window. */
  suggestedCrew: number | null;
  /** Number of work days in this phase span. */
  phaseWorkDayCount: number;
}

export interface LineItemSuggestion {
  lineItemId: string;
  /** Matching KPI data, if found. */
  kpi: WorkTypeKpi | null;
  /** Per-phase suggestions. */
  assembly: PhaseSuggestion;
  dismantle: PhaseSuggestion;
  /** Confidence of the suggestion. */
  confidence: ConfidenceLevel | null;
  /** Risk assessment for this line item. */
  risk: RiskLevel;
  /** Human-readable risk reasons. */
  riskReasons: string[];
}

export interface PlanSuggestions {
  items: LineItemSuggestion[];
  /** Count of line items with high risk. */
  highRiskCount: number;
  /** Count of line items with no KPI data. */
  noDataCount: number;
}

/** Classify risk from KPI data. */
function classifyRisk(
  kpi: WorkTypeKpi | null,
): { risk: RiskLevel; reasons: string[] } {
  if (!kpi) {
    return { risk: 'high', reasons: ['No historical data available'] };
  }

  const reasons: string[] = [];

  if (kpi.confidence === 'insufficient') {
    reasons.push(`Insufficient samples (${kpi.sampleCount})`);
  } else if (kpi.confidence === 'low') {
    reasons.push(`Low confidence (${kpi.sampleCount} samples)`);
  }

  if (kpi.cv != null && kpi.cv > HIGH_CV_THRESHOLD) {
    reasons.push(`High variability (CV ${(kpi.cv * 100).toFixed(0)}%)`);
  }

  if (kpi.outlierCount > 0) {
    reasons.push(`${kpi.outlierCount} outlier${kpi.outlierCount > 1 ? 's' : ''} in data`);
  }

  if (reasons.length === 0) return { risk: 'none', reasons: [] };
  if (kpi.confidence === 'insufficient' || (kpi.cv != null && kpi.cv > HIGH_CV_THRESHOLD)) {
    return { risk: 'high', reasons };
  }
  if (kpi.confidence === 'low' || kpi.outlierCount > 0) {
    return { risk: 'medium', reasons };
  }
  return { risk: 'low', reasons };
}

function resolveSuggestedRate(
  kpi: WorkTypeKpi | null,
): { suggestedRate: number | null; confidence: ConfidenceLevel | null } {
  if (!kpi || kpi.confidence === 'insufficient' || kpi.avgProductivity <= 0) {
    return { suggestedRate: null, confidence: null };
  }
  return { suggestedRate: kpi.avgProductivity, confidence: kpi.confidence };
}

function resolvePhaseSuggestedCrew(
  item: PlanLineItem,
  phase: BuildPhase,
  plan: Plan | null | undefined,
  suggestedRate: number | null,
): number | null {
  const quantity = getPhaseQuantity(item, phase);
  if (!plan || quantity <= 0) return null;

  const phaseSpan = getPhaseSpan(plan, phase);
  if (!phaseSpan) return null;

  const workDaysInPhase = (
    plan.workCalendar.length > 0
      ? plan.workCalendar
      : generateDefaultWorkCalendar(phaseSpan.start, phaseSpan.end, plan.defaultCrewSize)
  ).filter((day) => day.date >= phaseSpan.start && day.date <= phaseSpan.end && day.isWorkDay);

  if (workDaysInPhase.length === 0) return null;

  const firstDayAccessHours = dayAccessHours(workDaysInPhase[0]);
  const accessHoursPerDay = firstDayAccessHours > 0 ? firstDayAccessHours : 8;
  const totalAvailableHours = workDaysInPhase.length * accessHoursPerDay;
  if (totalAvailableHours <= 0) return null;

  const pf = getPhaseFields(item, phase);
  const effectiveRate =
    pf.rate > 0
      ? pf.rate
      : (suggestedRate != null && suggestedRate > 0 ? suggestedRate : null);
  if (effectiveRate == null) return null;

  const personHours = quantity / effectiveRate;
  if (!Number.isFinite(personHours) || personHours <= 0) return null;

  return Math.max(1, Math.ceil(personHours / totalAvailableHours));
}

/** Work days in the given phase span. Returns 0 when phase has no dates or no work days. Exported for phase-aware UI (e.g. Auto-schedule). */
export function getPhaseWorkDayCount(plan: Plan | null | undefined, phase: BuildPhase): number {
  if (!plan) return 0;
  const phaseSpan = getPhaseSpan(plan, phase);
  if (!phaseSpan) return 0;
  const workDays = (
    plan.workCalendar.length > 0
      ? plan.workCalendar
      : generateDefaultWorkCalendar(phaseSpan.start, phaseSpan.end, plan.defaultCrewSize)
  ).filter((day) => day.date >= phaseSpan.start && day.date <= phaseSpan.end && day.isWorkDay);
  return workDays.length;
}

function buildPhaseSuggestion(
  item: PlanLineItem,
  phase: BuildPhase,
  plan: Plan | null | undefined,
  suggestedRate: number | null,
): PhaseSuggestion {
  const pf = getPhaseFields(item, phase);
  const quantity = getPhaseQuantity(item, phase);

  let suggestedTimeHours: number | null = null;
  if (suggestedRate != null && pf.crew > 0 && quantity > 0) {
    suggestedTimeHours = quantity / (suggestedRate * pf.crew);
  }

  return {
    suggestedRate,
    suggestedTimeHours,
    suggestedCrew: resolvePhaseSuggestedCrew(item, phase, plan, suggestedRate),
    phaseWorkDayCount: getPhaseWorkDayCount(plan, phase),
  };
}

/**
 * Generate KPI-backed suggestions for all line items in a plan.
 */
export function generatePlanSuggestions(
  lineItems: PlanLineItem[],
  kpis: WorkTypeKpi[],
  plan?: Plan | null,
): PlanSuggestions {
  const items: LineItemSuggestion[] = lineItems.map((item) => {
    const key = lineItemWorkTypeKey(item);
    const kpi = findKpiByKey(kpis, key) ?? null;

    const { risk, reasons } = classifyRisk(kpi);
    const { suggestedRate, confidence } = resolveSuggestedRate(kpi);

    return {
      lineItemId: item.id,
      kpi,
      assembly: buildPhaseSuggestion(item, 'assembly', plan, suggestedRate),
      dismantle: buildPhaseSuggestion(item, 'dismantle', plan, suggestedRate),
      confidence,
      risk,
      riskReasons: reasons,
    };
  });

  return {
    items,
    highRiskCount: items.filter((i) => i.risk === 'high').length,
    noDataCount: items.filter((i) => i.kpi == null).length,
  };
}

/**
 * KPI-backed suggestions for plan line items.
 *
 * Looks up matching WorkTypeKpi data and attaches recommendations:
 * - Suggested productivity rate (from historical data)
 * - Recommended crew and time estimates
 * - Confidence level and risk flags
 */

import type { WorkTypeKpi } from '../kpi';
import { findKpiByKey, type ConfidenceLevel } from '../kpi';
import type { PlanLineItem } from './plan-model';
import { lineItemWorkTypeKey } from './plan-model';

/** Risk flag thresholds. */
const HIGH_CV_THRESHOLD = 0.4;

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface LineItemSuggestion {
  lineItemId: string;
  /** Matching KPI data, if found. */
  kpi: WorkTypeKpi | null;
  /** Suggested productivity rate from historical data. */
  suggestedRate: number | null;
  /** Recommended time (hours) based on suggested rate and item's quantity/crew. */
  suggestedTimeHours: number | null;
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

/**
 * Generate KPI-backed suggestions for all line items in a plan.
 */
export function generatePlanSuggestions(
  lineItems: PlanLineItem[],
  kpis: WorkTypeKpi[],
): PlanSuggestions {
  const items: LineItemSuggestion[] = lineItems.map((item) => {
    const key = lineItemWorkTypeKey(item);
    const kpi = findKpiByKey(kpis, key) ?? null;

    const { risk, reasons } = classifyRisk(kpi);

    let suggestedRate: number | null = null;
    let suggestedTimeHours: number | null = null;
    let confidence: ConfidenceLevel | null = null;

    if (kpi && kpi.confidence !== 'insufficient') {
      suggestedRate = kpi.avgProductivity;
      confidence = kpi.confidence;
      if (suggestedRate > 0 && item.crew > 0) {
        suggestedTimeHours = item.workQuantity / (suggestedRate * item.crew);
      }
    }

    return {
      lineItemId: item.id,
      kpi,
      suggestedRate,
      suggestedTimeHours,
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

import { describe, it, expect } from 'vitest';
import type { WorkTypeKpi } from '../kpi';
import type { PlanLineItem } from './plan-model';
import { generatePlanSuggestions } from './plan-suggestions';

function makeLineItem(overrides: Partial<PlanLineItem> = {}): PlanLineItem {
  return {
    id: 'li-1',
    title: 'Install carpet',
    workCategory: 'carpet-tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    workQuantity: 100,
    crew: 2,
    timeHours: 5,
    productivityRate: 10,
    rateSource: 'manual',
    rationale: null,
    ...overrides,
  };
}

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: { workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' },
    sampleCount: 10,
    avgProductivity: 12,
    totalQuantity: 1200,
    totalPersonHours: 100,
    confidence: 'high',
    cv: 0.1,
    outlierCount: 0,
    ...overrides,
  };
}

describe('generatePlanSuggestions', () => {
  it('provides suggestions from matching KPI', () => {
    const result = generatePlanSuggestions([makeLineItem()], [makeKpi()]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].suggestedRate).toBe(12);
    expect(result.items[0].confidence).toBe('high');
    expect(result.items[0].risk).toBe('none');
    // 100 / (12 * 2) = 4.166...
    expect(result.items[0].suggestedTimeHours).toBeCloseTo(4.167, 2);
  });

  it('flags high risk when no KPI data', () => {
    const result = generatePlanSuggestions([makeLineItem()], []);

    expect(result.items[0].kpi).toBeNull();
    expect(result.items[0].suggestedRate).toBeNull();
    expect(result.items[0].risk).toBe('high');
    expect(result.items[0].riskReasons).toContain('No historical data available');
    expect(result.noDataCount).toBe(1);
  });

  it('flags high risk for insufficient confidence', () => {
    const kpi = makeKpi({ sampleCount: 1, confidence: 'insufficient' });
    const result = generatePlanSuggestions([makeLineItem()], [kpi]);

    expect(result.items[0].suggestedRate).toBeNull(); // insufficient → no suggestion
    expect(result.items[0].risk).toBe('high');
  });

  it('flags high risk for high CV', () => {
    const kpi = makeKpi({ cv: 0.6 });
    const result = generatePlanSuggestions([makeLineItem()], [kpi]);

    expect(result.items[0].risk).toBe('high');
    expect(result.items[0].riskReasons.some((r) => r.includes('variability'))).toBe(true);
  });

  it('flags medium risk for low confidence', () => {
    const kpi = makeKpi({ confidence: 'low', sampleCount: 4, cv: 0.1 });
    const result = generatePlanSuggestions([makeLineItem()], [kpi]);

    expect(result.items[0].risk).toBe('medium');
  });

  it('flags medium risk for outliers', () => {
    const kpi = makeKpi({ outlierCount: 2, confidence: 'high', cv: 0.1 });
    const result = generatePlanSuggestions([makeLineItem()], [kpi]);

    expect(result.items[0].risk).toBe('medium');
    expect(result.items[0].riskReasons.some((r) => r.includes('outlier'))).toBe(true);
  });

  it('counts high risk items', () => {
    const items = [
      makeLineItem({ id: 'li-1' }),
      makeLineItem({ id: 'li-2', workCategory: 'furniture', workUnit: 'pcs' }),
    ];
    // Only one KPI matches li-1
    const result = generatePlanSuggestions(items, [makeKpi()]);

    expect(result.highRiskCount).toBe(1); // li-2 has no data
  });

  it('handles empty inputs', () => {
    const result = generatePlanSuggestions([], []);
    expect(result.items).toHaveLength(0);
    expect(result.highRiskCount).toBe(0);
    expect(result.noDataCount).toBe(0);
  });
});

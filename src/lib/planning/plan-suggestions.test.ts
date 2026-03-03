import { describe, it, expect } from 'vitest';
import type { WorkTypeKpi } from '../kpi';
import type { Plan, PlanLineItem } from './plan-model';
import { generatePlanSuggestions } from './plan-suggestions';

function makeLineItem(overrides: Partial<PlanLineItem> = {}): PlanLineItem {
  const base: PlanLineItem = {
    id: 'li-1',
    title: 'Install carpet',
    workTypeTitle: 'Carpet Tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    workTypeId: null,
    workQuantity: 100,
    crew: 2,
    timeHours: 5,
    productivityRate: 10,
    rateSource: 'manual',
    rationale: null,
    executionStatus: 'pending',
    blockReason: null,
    blockCategory: null,
    executorNote: null,
    deferredNote: null,
    removedFromSource: false,
    scheduledStart: null,
    scheduledEnd: null,
    originalScheduledStart: null,
    originalScheduledEnd: null,
    amendmentNote: null,
    amendedAt: null,
  };

  return {
    ...base,
    ...overrides,
    executionStatus: overrides.executionStatus ?? base.executionStatus,
    blockReason: overrides.blockReason ?? base.blockReason,
    blockCategory: overrides.blockCategory ?? base.blockCategory,
    executorNote: overrides.executorNote ?? base.executorNote,
    deferredNote: overrides.deferredNote ?? base.deferredNote,
    removedFromSource: overrides.removedFromSource ?? base.removedFromSource,
  };
}

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: { workTypeId: null, workTypeTitle: 'Carpet Tiles', workUnit: 'm2', buildPhase: 'build-up' },
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

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'Plan',
    status: 'draft',
    lineItems: [],
    projectId: null,
    eventStartDate: null,
    eventEndDate: null,
    buildUpStartDate: null,
    buildUpEndDate: null,
    tearDownStartDate: null,
    tearDownEndDate: null,
    defaultCrewSize: 2,
    workCalendar: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
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
      makeLineItem({ id: 'li-2', workTypeTitle: 'Furniture', workUnit: 'pcs' }),
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

  it('computes suggested crew from phase window with default calendar', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-06',
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
    });
    const item = makeLineItem({
      workQuantity: 500,
      productivityRate: 10,
      buildPhase: 'build-up',
    });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].suggestedCrew).toBe(2);
  });

  it('uses KPI rate for suggested crew when line-item rate is invalid', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-06',
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
    });
    const item = makeLineItem({
      workQuantity: 100,
      productivityRate: 0,
      buildPhase: 'build-up',
    });
    const kpi = makeKpi({ avgProductivity: 5, confidence: 'high' });

    const result = generatePlanSuggestions([item], [kpi], plan);
    expect(result.items[0].suggestedCrew).toBe(1);
  });

  it('returns null suggested crew when phase dates are missing', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: null,
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
    });
    const item = makeLineItem({ workQuantity: 100, productivityRate: 10 });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].suggestedCrew).toBeNull();
  });

  it('returns null suggested crew when phase has no work days', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-07',
      buildUpEndDate: '2026-03-08',
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
    });
    const item = makeLineItem({ workQuantity: 100, productivityRate: 10 });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].suggestedCrew).toBeNull();
  });

  it('returns null suggested crew when quantity or effective rate is invalid', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-06',
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
    });
    const zeroQuantity = makeLineItem({ id: 'li-zero-qty', workQuantity: 0, productivityRate: 10 });
    const zeroRate = makeLineItem({ id: 'li-zero-rate', workQuantity: 100, productivityRate: 0 });

    const result = generatePlanSuggestions([zeroQuantity, zeroRate], [], plan);
    expect(result.items[0].suggestedCrew).toBeNull();
    expect(result.items[1].suggestedCrew).toBeNull();
  });

  it('uses access hours from calendar day when custom calendar exists', () => {
    const plan = makePlan({
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-03',
      tearDownStartDate: '2026-03-09',
      tearDownEndDate: '2026-03-10',
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '06:00', accessEnd: '12:00', crewSize: null },
        { date: '2026-03-03', isWorkDay: true, accessStart: '06:00', accessEnd: '12:00', crewSize: null },
      ],
    });
    const item = makeLineItem({ workQuantity: 120, productivityRate: 10, buildPhase: 'build-up' });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].suggestedCrew).toBe(1);
  });
});

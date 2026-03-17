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
    workTypeId: null,
    workQuantity: 100,
    dismantleQuantity: null,
    assemblyRate: 10,
    assemblyCrew: 2,
    assemblyTimeHours: 5,
    assemblyRateSource: 'manual' as const,
    dismantleRate: 0,
    dismantleCrew: 0,
    dismantleTimeHours: 0,
    dismantleRateSource: 'manual' as const,
    assemblyScheduledStart: null,
    assemblyScheduledEnd: null,
    assemblyOriginalScheduledStart: null,
    assemblyOriginalScheduledEnd: null,
    assemblyPersonHoursByDate: undefined,
    dismantleScheduledStart: null,
    dismantleScheduledEnd: null,
    dismantleOriginalScheduledStart: null,
    dismantleOriginalScheduledEnd: null,
    dismantlePersonHoursByDate: undefined,
    assemblyExecutionStatus: 'pending' as const,
    assemblyBlockReason: null,
    assemblyBlockCategory: null,
    assemblyExecutorNote: null,
    assemblyDeferredNote: null,
    dismantleExecutionStatus: 'pending' as const,
    dismantleBlockReason: null,
    dismantleBlockCategory: null,
    dismantleExecutorNote: null,
    dismantleDeferredNote: null,
    rationale: null,
    removedFromSource: false,
    amendmentNote: null,
    amendedAt: null,
  };

  return {
    ...base,
    ...overrides,
  };
}

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: { workTypeId: null, workTypeTitle: 'Carpet Tiles', workUnit: 'm2' },
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
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
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
    expect(result.items[0].assembly.suggestedRate).toBe(12);
    expect(result.items[0].confidence).toBe('high');
    expect(result.items[0].risk).toBe('none');
    // 100 / (12 * 2) = 4.166...
    expect(result.items[0].assembly.suggestedTimeHours).toBeCloseTo(4.167, 2);
  });

  it('flags high risk when no KPI data', () => {
    const result = generatePlanSuggestions([makeLineItem()], []);

    expect(result.items[0].kpi).toBeNull();
    expect(result.items[0].assembly.suggestedRate).toBeNull();
    expect(result.items[0].risk).toBe('high');
    expect(result.items[0].riskReasons).toContain('No historical data available');
    expect(result.noDataCount).toBe(1);
  });

  it('flags high risk for insufficient confidence', () => {
    const kpi = makeKpi({ sampleCount: 1, confidence: 'insufficient' });
    const result = generatePlanSuggestions([makeLineItem()], [kpi]);

    expect(result.items[0].assembly.suggestedRate).toBeNull(); // insufficient → no suggestion
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
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-06',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const item = makeLineItem({
      workQuantity: 500,
      assemblyRate: 10,
    });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.suggestedCrew).toBe(2);
    expect(result.items[0].assembly.phaseWorkDayCount).toBeGreaterThan(0);
  });

  it('sets phaseWorkDayCount to 0 when phase has no work days', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-07',
      assemblyEndDate: '2026-03-08',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const item = makeLineItem();

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.phaseWorkDayCount).toBe(0);
  });

  it('uses KPI rate for suggested crew when line-item rate is invalid', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-06',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const item = makeLineItem({
      workQuantity: 100,
      assemblyRate: 0,
    });
    const kpi = makeKpi({ avgProductivity: 5, confidence: 'high' });

    const result = generatePlanSuggestions([item], [kpi], plan);
    expect(result.items[0].assembly.suggestedCrew).toBe(1);
  });

  it('computes phaseWorkDayCount and suggestedCrew for assembly when only assembly dates are set (dismantle optional)', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-06',
      dismantleStartDate: null,
      dismantleEndDate: null,
    });
    const item = makeLineItem({
      workQuantity: 500,
      assemblyRate: 10,
    });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.phaseWorkDayCount).toBeGreaterThan(0);
    expect(result.items[0].assembly.suggestedCrew).toBe(2);
  });

  it('returns null suggested crew when phase dates are missing', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: null,
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const item = makeLineItem({ workQuantity: 100, assemblyRate: 10 });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.suggestedCrew).toBeNull();
  });

  it('returns null suggested crew when phase has no work days', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-07',
      assemblyEndDate: '2026-03-08',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const item = makeLineItem({ workQuantity: 100, assemblyRate: 10 });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.suggestedCrew).toBeNull();
  });

  it('returns null suggested crew when quantity or effective rate is invalid', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-06',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
    });
    const zeroQuantity = makeLineItem({ id: 'li-zero-qty', workQuantity: 0, assemblyRate: 10 });
    const zeroRate = makeLineItem({ id: 'li-zero-rate', workQuantity: 100, assemblyRate: 0 });

    const result = generatePlanSuggestions([zeroQuantity, zeroRate], [], plan);
    expect(result.items[0].assembly.suggestedCrew).toBeNull();
    expect(result.items[1].assembly.suggestedCrew).toBeNull();
  });

  it('uses access hours from calendar day when custom calendar exists', () => {
    const plan = makePlan({
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-03',
      dismantleStartDate: '2026-03-09',
      dismantleEndDate: '2026-03-10',
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '06:00', accessEnd: '12:00', crewSize: null },
        { date: '2026-03-03', isWorkDay: true, accessStart: '06:00', accessEnd: '12:00', crewSize: null },
      ],
    });
    const item = makeLineItem({ workQuantity: 120, assemblyRate: 10 });

    const result = generatePlanSuggestions([item], [], plan);
    expect(result.items[0].assembly.suggestedCrew).toBe(1);
  });
});

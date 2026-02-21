import { describe, it, expect } from 'vitest';
import type { Plan, PlanLineItem } from './plan-model';
import { comparePlans } from './plan-compare';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'Plan A',
    status: 'draft',
    lineItems: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lockedAt: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<PlanLineItem> = {}): PlanLineItem {
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

describe('comparePlans', () => {
  it('detects unchanged line items', () => {
    const item = makeItem();
    const planA = makePlan({ lineItems: [item] });
    const planB = makePlan({ title: 'Plan B', lineItems: [item] });

    const result = comparePlans(planA, planB);

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].status).toBe('unchanged');
    expect(result.lineItems[0].changes).toHaveLength(0);
  });

  it('detects changed line items', () => {
    const itemA = makeItem({ crew: 2 });
    const itemB = makeItem({ crew: 4 });
    const planA = makePlan({ lineItems: [itemA] });
    const planB = makePlan({ title: 'Plan B', lineItems: [itemB] });

    const result = comparePlans(planA, planB);

    expect(result.lineItems[0].status).toBe('changed');
    expect(result.lineItems[0].changes).toHaveLength(1);
    expect(result.lineItems[0].changes[0].field).toBe('crew');
    expect(result.lineItems[0].changes[0].delta).toBe(2);
    expect(result.lineItems[0].changes[0].percentChange).toBe(1); // 100% increase
  });

  it('detects added line items', () => {
    const planA = makePlan({ lineItems: [] });
    const planB = makePlan({ title: 'Plan B', lineItems: [makeItem()] });

    const result = comparePlans(planA, planB);

    expect(result.lineItems[0].status).toBe('added');
  });

  it('detects removed line items', () => {
    const planA = makePlan({ lineItems: [makeItem()] });
    const planB = makePlan({ title: 'Plan B', lineItems: [] });

    const result = comparePlans(planA, planB);

    expect(result.lineItems[0].status).toBe('removed');
  });

  it('computes total person-hours delta', () => {
    const itemA = makeItem({ timeHours: 5, crew: 2 }); // 10 person-hours
    const itemB = makeItem({ timeHours: 8, crew: 2 }); // 16 person-hours
    const planA = makePlan({ lineItems: [itemA] });
    const planB = makePlan({ title: 'Plan B', lineItems: [itemB] });

    const result = comparePlans(planA, planB);

    expect(result.totalDelta.personHoursA).toBe(10);
    expect(result.totalDelta.personHoursB).toBe(16);
    expect(result.totalDelta.personHoursDelta).toBe(6);
  });

  it('handles multiple field changes', () => {
    const itemA = makeItem({ workQuantity: 100, crew: 2, timeHours: 5 });
    const itemB = makeItem({ workQuantity: 200, crew: 3, timeHours: 8 });
    const planA = makePlan({ lineItems: [itemA] });
    const planB = makePlan({ title: 'Plan B', lineItems: [itemB] });

    const result = comparePlans(planA, planB);

    expect(result.lineItems[0].changes.length).toBe(3);
  });

  it('computes percent change correctly', () => {
    const itemA = makeItem({ workQuantity: 100 });
    const itemB = makeItem({ workQuantity: 150 });
    const planA = makePlan({ lineItems: [itemA] });
    const planB = makePlan({ title: 'Plan B', lineItems: [itemB] });

    const result = comparePlans(planA, planB);

    const change = result.lineItems[0].changes.find((c) => c.field === 'workQuantity');
    expect(change!.percentChange).toBe(0.5); // 50% increase
  });

  it('handles empty plans', () => {
    const result = comparePlans(makePlan(), makePlan({ title: 'Plan B' }));

    expect(result.lineItems).toHaveLength(0);
    expect(result.totalDelta.personHoursDelta).toBe(0);
  });
});

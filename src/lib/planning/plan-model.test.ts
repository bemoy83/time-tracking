import { describe, it, expect } from 'vitest';
import {
  createPlan,
  createLineItem,
  lockPlan,
  unlockPlan,
  addLineItemToPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
  planTotalPersonHours,
  planTotalsByUnit,
  lineItemWorkTypeKey,
} from './plan-model';

describe('createPlan', () => {
  it('creates a draft plan with empty line items', () => {
    const plan = createPlan('Test Plan');
    expect(plan.title).toBe('Test Plan');
    expect(plan.status).toBe('draft');
    expect(plan.lineItems).toHaveLength(0);
    expect(plan.lockedAt).toBeNull();
    expect(plan.id).toBeTruthy();
  });
});

describe('createLineItem', () => {
  it('creates a line item with computed time', () => {
    const item = createLineItem('Install carpet', 'carpet-tiles', 'm2', 'build-up', 100, 10);
    expect(item.title).toBe('Install carpet');
    expect(item.workQuantity).toBe(100);
    expect(item.productivityRate).toBe(10);
    expect(item.timeHours).toBe(10); // 100 / 10
    expect(item.crew).toBe(1);
    expect(item.rateSource).toBe('manual');
  });

  it('handles zero productivity rate', () => {
    const item = createLineItem('Task', 'furniture', 'pcs', 'build-up', 50, 0);
    expect(item.timeHours).toBe(0);
  });
});

describe('lockPlan / unlockPlan', () => {
  it('locks a plan', () => {
    const plan = createPlan('Test');
    const locked = lockPlan(plan);
    expect(locked.status).toBe('locked');
    expect(locked.lockedAt).toBeTruthy();
  });

  it('unlocks a plan', () => {
    const locked = lockPlan(createPlan('Test'));
    const unlocked = unlockPlan(locked);
    expect(unlocked.status).toBe('draft');
    expect(unlocked.lockedAt).toBeNull();
  });
});

describe('plan line item operations', () => {
  it('adds a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'carpet-tiles', 'm2', 'build-up', 100, 10);
    const updated = addLineItemToPlan(plan, item);
    expect(updated.lineItems).toHaveLength(1);
  });

  it('removes a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'carpet-tiles', 'm2', 'build-up', 100, 10);
    const withItem = addLineItemToPlan(plan, item);
    const removed = removeLineItemFromPlan(withItem, item.id);
    expect(removed.lineItems).toHaveLength(0);
  });

  it('updates a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'carpet-tiles', 'm2', 'build-up', 100, 10);
    const withItem = addLineItemToPlan(plan, item);
    const updated = updatePlanLineItem(withItem, item.id, { crew: 3 });
    expect(updated.lineItems[0].crew).toBe(3);
  });
});

describe('planTotalPersonHours', () => {
  it('sums time × crew across all items', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'carpet-tiles', 'm2', 'build-up', 100, 10)); // 10h × 1 crew = 10
    const item2 = { ...createLineItem('B', 'furniture', 'pcs', 'build-up', 50, 5), crew: 2 }; // 10h × 2 crew = 20
    plan = addLineItemToPlan(plan, item2);
    expect(planTotalPersonHours(plan)).toBe(30);
  });
});

describe('planTotalsByUnit', () => {
  it('groups quantity by work unit', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'carpet-tiles', 'm2', 'build-up', 100, 10));
    plan = addLineItemToPlan(plan, createLineItem('B', 'carpet-tiles', 'm2', 'build-up', 200, 10));
    plan = addLineItemToPlan(plan, createLineItem('C', 'furniture', 'pcs', 'build-up', 50, 5));

    const totals = planTotalsByUnit(plan);
    expect(totals.get('m2')).toBe(300);
    expect(totals.get('pcs')).toBe(50);
  });
});

describe('lineItemWorkTypeKey', () => {
  it('extracts work type key from line item', () => {
    const item = createLineItem('Task', 'carpet-tiles', 'm2', 'build-up', 100, 10);
    const key = lineItemWorkTypeKey(item);
    expect(key.workCategory).toBe('carpet-tiles');
    expect(key.workUnit).toBe('m2');
    expect(key.buildPhase).toBe('build-up');
  });
});

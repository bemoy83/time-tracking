import { describe, it, expect } from 'vitest';
import {
  createPlan,
  createLineItem,
  activatePlan,
  revertToDraft,
  addLineItemToPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
  planTotalPersonHours,
  planTotalsByUnit,
  lineItemWorkTypeKey,
  duplicateLineItem,
} from './plan-model';

describe('createPlan', () => {
  it('creates a draft plan with empty line items', () => {
    const plan = createPlan('Test Plan');
    expect(plan.title).toBe('Test Plan');
    expect(plan.status).toBe('draft');
    expect(plan.lineItems).toHaveLength(0);
    expect(plan.projectId).toBeNull();
    expect(plan.activatedAt).toBeNull();
    expect(plan.reviewedAt).toBeNull();
    expect(plan.id).toBeTruthy();
  });
});

describe('createLineItem', () => {
  it('creates a line item with computed time', () => {
    const item = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    expect(item.title).toBe('Install carpet');
    expect(item.workQuantity).toBe(100);
    expect(item.productivityRate).toBe(10);
    expect(item.timeHours).toBe(10); // 100 / 10
    expect(item.crew).toBe(1);
    expect(item.rateSource).toBe('manual');
    expect(item.reviewNote).toBeNull();
    expect(item.scheduledStart).toBeNull();
    expect(item.scheduledEnd).toBeNull();
  });

  it('handles zero productivity rate', () => {
    const item = createLineItem('Task', 'Furniture', 'pcs', 'build-up', 50, 0);
    expect(item.timeHours).toBe(0);
  });
});

describe('activatePlan / revertToDraft', () => {
  it('activates a plan', () => {
    const plan = createPlan('Test');
    const active = activatePlan(plan);
    expect(active.status).toBe('active');
    expect(active.activatedAt).toBeTruthy();
  });

  it('reverts a plan to draft', () => {
    const active = activatePlan(createPlan('Test'));
    const reverted = revertToDraft(active);
    expect(reverted.status).toBe('draft');
    expect(reverted.activatedAt).toBeNull();
  });
});

describe('plan line item operations', () => {
  it('adds a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const updated = addLineItemToPlan(plan, item);
    expect(updated.lineItems).toHaveLength(1);
  });

  it('removes a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const withItem = addLineItemToPlan(plan, item);
    const removed = removeLineItemFromPlan(withItem, item.id);
    expect(removed.lineItems).toHaveLength(0);
  });

  it('updates a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const withItem = addLineItemToPlan(plan, item);
    const updated = updatePlanLineItem(withItem, item.id, { crew: 3 });
    expect(updated.lineItems[0].crew).toBe(3);
  });
});

describe('planTotalPersonHours', () => {
  it('sums time × crew across all items', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'Carpet Tiles', 'm2', 'build-up', 100, 10)); // 10h × 1 crew = 10
    const item2 = { ...createLineItem('B', 'Furniture', 'pcs', 'build-up', 50, 5), crew: 2 }; // 10h × 2 crew = 20
    plan = addLineItemToPlan(plan, item2);
    expect(planTotalPersonHours(plan)).toBe(30);
  });
});

describe('planTotalsByUnit', () => {
  it('groups quantity by work unit', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'Carpet Tiles', 'm2', 'build-up', 100, 10));
    plan = addLineItemToPlan(plan, createLineItem('B', 'Carpet Tiles', 'm2', 'build-up', 200, 10));
    plan = addLineItemToPlan(plan, createLineItem('C', 'Furniture', 'pcs', 'build-up', 50, 5));

    const totals = planTotalsByUnit(plan);
    expect(totals.get('m2')).toBe(300);
    expect(totals.get('pcs')).toBe(50);
  });
});

describe('lineItemWorkTypeKey', () => {
  it('extracts work type key from line item', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const key = lineItemWorkTypeKey(item);
    expect(key.workTypeTitle).toBe('Carpet Tiles');
    expect(key.workUnit).toBe('m2');
    expect(key.buildPhase).toBe('build-up');
  });
});

describe('duplicateLineItem', () => {
  it('copies work-type and assumption fields with a normalized copy title', () => {
    const original = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 'build-up', 100, 10, 'historical', 'wt-1');
    original.crew = 3;
    original.timeHours = 12.5;
    original.rationale = 'Keep a note';

    const duplicate = duplicateLineItem(original);

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.title).toBe('Install carpet (copy)');
    expect(duplicate.workTypeTitle).toBe(original.workTypeTitle);
    expect(duplicate.workUnit).toBe(original.workUnit);
    expect(duplicate.buildPhase).toBe(original.buildPhase);
    expect(duplicate.workTypeId).toBe(original.workTypeId);
    expect(duplicate.workQuantity).toBe(original.workQuantity);
    expect(duplicate.crew).toBe(original.crew);
    expect(duplicate.timeHours).toBe(original.timeHours);
    expect(duplicate.productivityRate).toBe(original.productivityRate);
    expect(duplicate.rateSource).toBe(original.rateSource);
    expect(duplicate.rationale).toBeNull();
    expect(duplicate.reviewNote).toBeNull();
    expect(duplicate.scheduledStart).toBe(original.scheduledStart);
    expect(duplicate.scheduledEnd).toBe(original.scheduledEnd);
  });

  it('does not accumulate repeated copy suffixes', () => {
    const original = createLineItem('Install carpet (copy)', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const duplicate = duplicateLineItem(original);
    expect(duplicate.title).toBe('Install carpet (copy)');
  });
});

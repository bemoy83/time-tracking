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
    expect(plan.eventStartDate).toBeNull();
    expect(plan.eventEndDate).toBeNull();
    expect(plan.assemblyStartDate).toBeNull();
    expect(plan.assemblyEndDate).toBeNull();
    expect(plan.dismantleStartDate).toBeNull();
    expect(plan.dismantleEndDate).toBeNull();
    expect(plan.defaultCrewSize).toBeNull();
    expect(plan.workCalendar).toEqual([]);
    expect(plan.activatedAt).toBeNull();
    expect(plan.reviewedAt).toBeNull();
    expect(plan.id).toBeTruthy();
  });
});

describe('createLineItem', () => {
  it('creates a line item with computed time', () => {
    const item = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0);
    expect(item.title).toBe('Install carpet');
    expect(item.workQuantity).toBe(100);
    expect(item.assemblyRate).toBe(10);
    expect(item.assemblyTimeHours).toBe(10); // 100 / 10
    expect(item.assemblyCrew).toBe(1);
    expect(item.assemblyRateSource).toBe('manual');
    expect(item.reviewNote).toBeNull();
    expect(item.assemblyScheduledStart).toBeNull();
    expect(item.assemblyScheduledEnd).toBeNull();
    expect(item.assemblyOriginalScheduledStart).toBeNull();
    expect(item.assemblyOriginalScheduledEnd).toBeNull();
    expect(item.amendmentNote).toBeNull();
    expect(item.amendedAt).toBeNull();
  });

  it('handles zero productivity rate', () => {
    const item = createLineItem('Task', 'Furniture', 'pcs', 50, 0, 0);
    expect(item.assemblyTimeHours).toBe(0);
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
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 100, 10, 0);
    const updated = addLineItemToPlan(plan, item);
    expect(updated.lineItems).toHaveLength(1);
  });

  it('removes a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 100, 10, 0);
    const withItem = addLineItemToPlan(plan, item);
    const removed = removeLineItemFromPlan(withItem, item.id);
    expect(removed.lineItems).toHaveLength(0);
  });

  it('updates a line item', () => {
    const plan = createPlan('Test');
    const item = createLineItem('Task A', 'Carpet Tiles', 'm2', 100, 10, 0);
    const withItem = addLineItemToPlan(plan, item);
    const updated = updatePlanLineItem(withItem, item.id, { assemblyCrew: 3 });
    expect(updated.lineItems[0].assemblyCrew).toBe(3);
  });
});

describe('planTotalPersonHours', () => {
  it('sums time × crew across all items', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'Carpet Tiles', 'm2', 100, 10, 0)); // 10h × 1 crew = 10
    const item2 = { ...createLineItem('B', 'Furniture', 'pcs', 50, 5, 0), assemblyCrew: 2 }; // 10h × 2 crew = 20
    plan = addLineItemToPlan(plan, item2);
    expect(planTotalPersonHours(plan)).toBe(30);
  });
});

describe('planTotalsByUnit', () => {
  it('groups quantity by work unit', () => {
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'Carpet Tiles', 'm2', 100, 10, 0));
    plan = addLineItemToPlan(plan, createLineItem('B', 'Carpet Tiles', 'm2', 200, 10, 0));
    plan = addLineItemToPlan(plan, createLineItem('C', 'Furniture', 'pcs', 50, 5, 0));

    const totals = planTotalsByUnit(plan);
    expect(totals.get('m2')).toBe(300);
    expect(totals.get('pcs')).toBe(50);
  });
});

describe('lineItemWorkTypeKey', () => {
  it('extracts work type key from line item', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 100, 10, 0);
    const key = lineItemWorkTypeKey(item);
    expect(key.workTypeTitle).toBe('Carpet Tiles');
    expect(key.workUnit).toBe('m2');
  });
});

describe('duplicateLineItem', () => {
  it('copies work-type and assumption fields with a normalized copy title', () => {
    const original = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0, 'historical', 'wt-1');
    original.assemblyCrew = 3;
    original.assemblyTimeHours = 12.5;
    original.rationale = 'Keep a note';

    const duplicate = duplicateLineItem(original);

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.title).toBe('Install carpet (copy)');
    expect(duplicate.workTypeTitle).toBe(original.workTypeTitle);
    expect(duplicate.workUnit).toBe(original.workUnit);
    expect(duplicate.workTypeId).toBe(original.workTypeId);
    expect(duplicate.workQuantity).toBe(original.workQuantity);
    expect(duplicate.assemblyCrew).toBe(original.assemblyCrew);
    expect(duplicate.assemblyTimeHours).toBe(original.assemblyTimeHours);
    expect(duplicate.assemblyRate).toBe(original.assemblyRate);
    expect(duplicate.assemblyRateSource).toBe(original.assemblyRateSource);
    expect(duplicate.rationale).toBeNull();
    expect(duplicate.reviewNote).toBeNull();
    expect(duplicate.assemblyScheduledStart).toBe(original.assemblyScheduledStart);
    expect(duplicate.assemblyScheduledEnd).toBe(original.assemblyScheduledEnd);
    expect(duplicate.assemblyOriginalScheduledStart).toBe(original.assemblyOriginalScheduledStart);
    expect(duplicate.assemblyOriginalScheduledEnd).toBe(original.assemblyOriginalScheduledEnd);
    expect(duplicate.amendmentNote).toBe(original.amendmentNote);
    expect(duplicate.amendedAt).toBe(original.amendedAt);
  });

  it('does not accumulate repeated copy suffixes', () => {
    const original = createLineItem('Install carpet (copy)', 'Carpet Tiles', 'm2', 100, 10, 0);
    const duplicate = duplicateLineItem(original);
    expect(duplicate.title).toBe('Install carpet (copy)');
  });
});

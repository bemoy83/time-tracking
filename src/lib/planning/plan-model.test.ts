import { describe, it, expect, vi } from 'vitest';
import {
  createPlan,
  createLineItem,
  activatePlan,
  normalizePlanEfficiency,
  resolvePlanEfficiency,
  DEFAULT_PLAN_EFFICIENCY,
  revertToDraft,
  addLineItemToPlan,
  duplicateAllLineItemsInPlan,
  removeLineItemFromPlan,
  removeAllLineItemsFromPlan,
  updatePlanLineItem,
  planTotalPersonHours,
  planTotalsByUnit,
  lineItemWorkTypeKey,
  duplicateLineItem,
  getPhaseFields,
  getPhaseQuantity,
  getPlanDisplayName,
  phaseFieldUpdates,
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

describe('getPlanDisplayName', () => {
  it('prefers the linked project name when present', () => {
    const plan = createPlan('Standalone Work');
    expect(getPlanDisplayName(plan, { name: 'Main Event' })).toBe('Main Event');
  });

  it('falls back to the stored plan title when no project is linked', () => {
    const plan = createPlan('Standalone Work');
    expect(getPlanDisplayName(plan, null)).toBe('Standalone Work');
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

describe('duplicateAllLineItemsInPlan', () => {
  it('duplicates every line item once and appends the copies in original order', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    let plan = createPlan('Test');
    const originalA = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0);
    const originalB = createLineItem('Install chairs (copy)', 'Furniture', 'pcs', 50, 5, 0);
    plan = addLineItemToPlan(plan, originalA);
    plan = addLineItemToPlan(plan, originalB);
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));

    const duplicated = duplicateAllLineItemsInPlan(plan);

    expect(duplicated.updatedAt).not.toBe(plan.updatedAt);
    expect(duplicated.lineItems).toHaveLength(4);
    expect(duplicated.lineItems[0]).toBe(originalA);
    expect(duplicated.lineItems[1]).toBe(originalB);

    const duplicateA = duplicated.lineItems[2];
    const duplicateB = duplicated.lineItems[3];

    expect(duplicateA.id).not.toBe(originalA.id);
    expect(duplicateA.title).toBe('Install carpet (copy)');
    expect(duplicateA.workTypeTitle).toBe(originalA.workTypeTitle);
    expect(duplicateA.workQuantity).toBe(originalA.workQuantity);

    expect(duplicateB.id).not.toBe(originalB.id);
    expect(duplicateB.title).toBe('Install chairs (copy)');
    expect(duplicateB.workTypeTitle).toBe(originalB.workTypeTitle);
    expect(duplicateB.workQuantity).toBe(originalB.workQuantity);

    vi.useRealTimers();
  });

  it('returns an empty plan with a fresh updatedAt when there are no line items', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const plan = createPlan('Empty');
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));

    const duplicated = duplicateAllLineItemsInPlan(plan);

    expect(duplicated.lineItems).toEqual([]);
    expect(duplicated.updatedAt).not.toBe(plan.updatedAt);

    vi.useRealTimers();
  });
});

describe('removeAllLineItemsFromPlan', () => {
  it('removes every line item and updates the timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    let plan = createPlan('Test');
    plan = addLineItemToPlan(plan, createLineItem('A', 'Carpet Tiles', 'm2', 100, 10, 0));
    plan = addLineItemToPlan(plan, createLineItem('B', 'Furniture', 'pcs', 50, 5, 0));
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));

    const cleared = removeAllLineItemsFromPlan(plan);

    expect(cleared.lineItems).toEqual([]);
    expect(cleared.updatedAt).not.toBe(plan.updatedAt);

    vi.useRealTimers();
  });

  it('keeps an empty plan empty and still refreshes updatedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const plan = createPlan('Empty');
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));

    const cleared = removeAllLineItemsFromPlan(plan);

    expect(cleared.lineItems).toEqual([]);
    expect(cleared.updatedAt).not.toBe(plan.updatedAt);

    vi.useRealTimers();
  });
});

describe('phase field config map', () => {
  it('reads and writes phase fields through the shared config', () => {
    const item = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 5);
    item.dismantleQuantity = 80;

    const assemblyFields = getPhaseFields(item, 'assembly');
    const dismantleFields = getPhaseFields(item, 'dismantle');

    expect(assemblyFields.rate).toBe(10);
    expect(dismantleFields.rate).toBe(5);
    expect(getPhaseQuantity(item, 'assembly')).toBe(100);
    expect(getPhaseQuantity(item, 'dismantle')).toBe(80);

    expect(
      phaseFieldUpdates('assembly', {
        rate: 12,
        crew: 3,
        blockReason: 'Waiting on access',
      }),
    ).toEqual({
      assemblyRate: 12,
      assemblyCrew: 3,
      assemblyBlockReason: 'Waiting on access',
    });

    expect(
      phaseFieldUpdates('dismantle', {
        timeHours: 7,
        deferredNote: 'Shifted to final day',
      }),
    ).toEqual({
      dismantleTimeHours: 7,
      dismantleDeferredNote: 'Shifted to final day',
    });
  });
});

describe('normalizePlanEfficiency', () => {
  it('returns null for null input', () => {
    expect(normalizePlanEfficiency(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePlanEfficiency(undefined)).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(normalizePlanEfficiency(NaN)).toBeNull();
    expect(normalizePlanEfficiency(Infinity)).toBeNull();
  });

  it('passes through valid values unchanged', () => {
    expect(normalizePlanEfficiency(0.8)).toBe(0.8);
    expect(normalizePlanEfficiency(0.5)).toBe(0.5);
    expect(normalizePlanEfficiency(1.0)).toBe(1.0);
  });

  it('clamps values below 0.5 to 0.5', () => {
    expect(normalizePlanEfficiency(0.3)).toBe(0.5);
    expect(normalizePlanEfficiency(0)).toBe(0.5);
  });

  it('clamps values above 1.0 to 1.0', () => {
    expect(normalizePlanEfficiency(1.2)).toBe(1.0);
    expect(normalizePlanEfficiency(2.0)).toBe(1.0);
  });
});

describe('resolvePlanEfficiency', () => {
  it('returns DEFAULT_PLAN_EFFICIENCY when defaultEfficiency is null', () => {
    expect(resolvePlanEfficiency({ defaultEfficiency: null })).toBe(DEFAULT_PLAN_EFFICIENCY);
    expect(resolvePlanEfficiency({ defaultEfficiency: null })).toBe(0.8);
  });

  it('returns the plan value when set', () => {
    expect(resolvePlanEfficiency({ defaultEfficiency: 0.7 })).toBe(0.7);
    expect(resolvePlanEfficiency({ defaultEfficiency: 1.0 })).toBe(1.0);
  });

  it('clamps out-of-range values', () => {
    expect(resolvePlanEfficiency({ defaultEfficiency: 0.2 })).toBe(0.5);
    expect(resolvePlanEfficiency({ defaultEfficiency: 1.5 })).toBe(1.0);
  });
});

describe('createPlan', () => {
  it('initializes defaultEfficiency as null', () => {
    const plan = createPlan('Test');
    expect(plan.defaultEfficiency).toBeNull();
  });
});

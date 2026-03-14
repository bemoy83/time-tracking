import { describe, it, expect } from 'vitest';
import { lineItemToCreateTaskInput } from './release-plan';
import { createLineItem } from './plan-model';

describe('lineItemToCreateTaskInput', () => {
  it('maps all fields correctly', () => {
    const item = createLineItem(
      'Install carpet',
      'Carpet Tiles',
      'm2',
      100,
      10,
      0,
      'template',
      'wt-123',
    );
    item.assemblyCrew = 3;

    const input = lineItemToCreateTaskInput(item, 'assembly', { planId: 'plan-1' });

    expect(input.title).toBe('Install carpet — Assembly');
    expect(input.sourcePlanId).toBe('plan-1');
    expect(input.sourceLineItemId).toBe(item.id);
    expect(input.workTypeId).toBe('wt-123');
    expect(input.workQuantity).toBe(100);
    expect(input.workUnit).toBe('m2');
    expect(input.crew).toBe(3);
    expect(input.targetProductivity).toBe(10);
    expect(input.buildPhase).toBe('assembly');
    expect(input.estimatedMinutes).toBe(600); // 10 hours * 60
  });

  it('returns undefined estimatedMinutes when timeHours is 0', () => {
    const item = createLineItem('Task', 'Furniture', 'pcs', 50, 0, 0);
    const input = lineItemToCreateTaskInput(item, 'assembly');

    expect(input.estimatedMinutes).toBeUndefined();
  });

  it('rounds fractional estimatedMinutes', () => {
    const item = createLineItem('Task', 'Drywall', 'm2', 10, 3, 0);
    // assemblyTimeHours = 10 / 3 ≈ 3.333... → 200 minutes
    const input = lineItemToCreateTaskInput(item, 'assembly');

    expect(input.estimatedMinutes).toBe(200);
  });

  it('maps null workTypeId to undefined', () => {
    const item = createLineItem('Legacy item', 'Old Type', 'm2', 20, 5, 0);
    // workTypeId defaults to null
    const input = lineItemToCreateTaskInput(item, 'assembly');

    expect(input.workTypeId).toBeUndefined();
  });

  it('applies projectId override when provided', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 100, 10, 0);
    const input = lineItemToCreateTaskInput(item, 'assembly', { projectId: 'proj-1' });
    expect(input.projectId).toBe('proj-1');
  });

  it('maps null projectId override to undefined', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 100, 10, 0);
    const input = lineItemToCreateTaskInput(item, 'assembly', { projectId: null });
    expect(input.projectId).toBeUndefined();
  });

  it('maps missing planId override to undefined sourcePlanId while retaining sourceLineItemId', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 100, 10, 0);
    const input = lineItemToCreateTaskInput(item, 'assembly');
    expect(input.sourcePlanId).toBeUndefined();
    expect(input.sourceLineItemId).toBe(item.id);
  });

  it('maps dismantle phase quantity override and title', () => {
    const item = createLineItem('Strike carpet', 'Carpet Tiles', 'm2', 100, 10, 5);
    item.dismantleQuantity = 90;
    const input = lineItemToCreateTaskInput(item, 'dismantle');

    expect(input.title).toBe('Strike carpet — Dismantle');
    expect(input.buildPhase).toBe('dismantle');
    expect(input.workQuantity).toBe(90);
    expect(input.targetProductivity).toBe(5);
  });
});

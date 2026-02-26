import { describe, it, expect } from 'vitest';
import { lineItemToCreateTaskInput } from './release-plan';
import { createLineItem } from './plan-model';

describe('lineItemToCreateTaskInput', () => {
  it('maps all fields correctly', () => {
    const item = createLineItem(
      'Install carpet',
      'Carpet Tiles',
      'm2',
      'build-up',
      100,
      10,
      'template',
      'wt-123',
    );
    item.crew = 3;

    const input = lineItemToCreateTaskInput(item, { planId: 'plan-1' });

    expect(input.title).toBe('Install carpet');
    expect(input.sourcePlanId).toBe('plan-1');
    expect(input.sourceLineItemId).toBe(item.id);
    expect(input.workTypeId).toBe('wt-123');
    expect(input.workQuantity).toBe(100);
    expect(input.workUnit).toBe('m2');
    expect(input.defaultWorkers).toBe(3);
    expect(input.targetProductivity).toBe(10);
    expect(input.buildPhase).toBe('build-up');
    expect(input.estimatedMinutes).toBe(600); // 10 hours * 60
  });

  it('returns undefined estimatedMinutes when timeHours is 0', () => {
    const item = createLineItem('Task', 'Furniture', 'pcs', 'build-up', 50, 0);
    const input = lineItemToCreateTaskInput(item);

    expect(input.estimatedMinutes).toBeUndefined();
  });

  it('rounds fractional estimatedMinutes', () => {
    const item = createLineItem('Task', 'Drywall', 'm2', 'tear-down', 10, 3);
    // timeHours = 10 / 3 ≈ 3.333... → 200 minutes
    const input = lineItemToCreateTaskInput(item);

    expect(input.estimatedMinutes).toBe(200);
  });

  it('maps null workTypeId to undefined', () => {
    const item = createLineItem('Legacy item', 'Old Type', 'm2', 'build-up', 20, 5);
    // workTypeId defaults to null
    const input = lineItemToCreateTaskInput(item);

    expect(input.workTypeId).toBeUndefined();
  });

  it('applies projectId override when provided', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const input = lineItemToCreateTaskInput(item, { projectId: 'proj-1' });
    expect(input.projectId).toBe('proj-1');
  });

  it('maps null projectId override to undefined', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const input = lineItemToCreateTaskInput(item, { projectId: null });
    expect(input.projectId).toBeUndefined();
  });

  it('maps missing planId override to undefined sourcePlanId while retaining sourceLineItemId', () => {
    const item = createLineItem('Task', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const input = lineItemToCreateTaskInput(item);
    expect(input.sourcePlanId).toBeUndefined();
    expect(input.sourceLineItemId).toBe(item.id);
  });
});

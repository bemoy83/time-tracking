import { describe, expect, it } from 'vitest';
import type { Plan } from './plan-model';
import { createPlan, createLineItem } from './plan-model';
import { selectedPlanItemsToCreateTaskInputs } from './release-selection';

function withItems(plan: Plan, itemTitles: string[]) {
  const items = itemTitles.map((title) =>
    createLineItem(title, 'Carpet Tiles', 'm2', 'build-up', 10, 5, 'template', 'wt-1'),
  );
  return {
    ...plan,
    lineItems: items,
  };
}

describe('selectedPlanItemsToCreateTaskInputs', () => {
  it('maps selected items across plans and preserves plan project inheritance', () => {
    const planA = withItems({ ...createPlan('Plan A'), projectId: 'project-a' }, ['A1', 'A2']);
    const planB = withItems({ ...createPlan('Plan B'), projectId: 'project-b' }, ['B1']);

    const selected = new Set([planA.lineItems[0].id, planB.lineItems[0].id]);
    const inputs = selectedPlanItemsToCreateTaskInputs([planA, planB], selected);

    expect(inputs).toHaveLength(2);
    expect(inputs[0].title).toBe('A1');
    expect(inputs[0].projectId).toBe('project-a');
    expect(inputs[0].sourcePlanId).toBe(planA.id);
    expect(inputs[0].sourceLineItemId).toBe(planA.lineItems[0].id);
    expect(inputs[1].title).toBe('B1');
    expect(inputs[1].projectId).toBe('project-b');
    expect(inputs[1].sourcePlanId).toBe(planB.id);
    expect(inputs[1].sourceLineItemId).toBe(planB.lineItems[0].id);
  });

  it('maps null plan projectId to undefined task projectId', () => {
    const plan = withItems({ ...createPlan('Plan A'), projectId: null }, ['A1']);
    const selected = new Set([plan.lineItems[0].id]);
    const inputs = selectedPlanItemsToCreateTaskInputs([plan], selected);

    expect(inputs).toHaveLength(1);
    expect(inputs[0].projectId).toBeUndefined();
  });

  it('returns only selected items', () => {
    const plan = withItems({ ...createPlan('Plan A'), projectId: 'project-a' }, ['A1', 'A2', 'A3']);
    const selected = new Set([plan.lineItems[1].id]);
    const inputs = selectedPlanItemsToCreateTaskInputs([plan], selected);

    expect(inputs).toHaveLength(1);
    expect(inputs[0].title).toBe('A2');
  });
});

import { describe, expect, it } from 'vitest';
import type { Plan } from './plan-model';
import { createPlan, createLineItem } from './plan-model';
import {
  encodePlanLineItemPhaseSelection,
  selectedPlanItemsToCreateTaskInputs,
} from './release-selection';

function withItems(plan: Plan, itemTitles: string[]) {
  const items = itemTitles.map((title) =>
    createLineItem(title, 'Carpet Tiles', 'm2', 10, 5, 0, 'template', 'wt-1'),
  );
  return {
    ...plan,
    lineItems: items,
  };
}

describe('selectedPlanItemsToCreateTaskInputs', () => {
  it('maps selected item phases across plans and preserves plan project inheritance', () => {
    const planA = withItems({ ...createPlan('Plan A'), projectId: 'project-a' }, ['A1', 'A2']);
    const planB = withItems({ ...createPlan('Plan B'), projectId: 'project-b' }, ['B1']);

    planA.lineItems[0].dismantleRate = 4;
    planA.lineItems[0].dismantleCrew = 2;
    planA.lineItems[0].dismantleTimeHours = 2.5;
    planA.lineItems[0].dismantleRateSource = 'template';
    const selected = new Set([
      encodePlanLineItemPhaseSelection({
        planId: planA.id,
        lineItemId: planA.lineItems[0].id,
        phase: 'assembly',
      }),
      encodePlanLineItemPhaseSelection({
        planId: planA.id,
        lineItemId: planA.lineItems[0].id,
        phase: 'dismantle',
      }),
      encodePlanLineItemPhaseSelection({
        planId: planB.id,
        lineItemId: planB.lineItems[0].id,
        phase: 'assembly',
      }),
    ]);
    const inputs = selectedPlanItemsToCreateTaskInputs([planA, planB], selected);

    expect(inputs).toHaveLength(3);
    expect(inputs[0].title).toBe('A1 — Assembly');
    expect(inputs[0].projectId).toBe('project-a');
    expect(inputs[0].sourcePlanId).toBe(planA.id);
    expect(inputs[0].sourceLineItemId).toBe(planA.lineItems[0].id);
    expect(inputs[1].title).toBe('A1 — Dismantle');
    expect(inputs[1].phase).toBe('dismantle');
    expect(inputs[2].title).toBe('B1 — Assembly');
    expect(inputs[2].projectId).toBe('project-b');
    expect(inputs[2].sourcePlanId).toBe(planB.id);
    expect(inputs[2].sourceLineItemId).toBe(planB.lineItems[0].id);
  });

  it('maps null plan projectId to undefined task projectId', () => {
    const plan = withItems({ ...createPlan('Plan A'), projectId: null }, ['A1']);
    const selected = new Set([
      encodePlanLineItemPhaseSelection({
        planId: plan.id,
        lineItemId: plan.lineItems[0].id,
        phase: 'assembly',
      }),
    ]);
    const inputs = selectedPlanItemsToCreateTaskInputs([plan], selected);

    expect(inputs).toHaveLength(1);
    expect(inputs[0].projectId).toBeUndefined();
  });

  it('returns only selected active phases', () => {
    const plan = withItems({ ...createPlan('Plan A'), projectId: 'project-a' }, ['A1', 'A2', 'A3']);
    const selected = new Set([
      encodePlanLineItemPhaseSelection({
        planId: plan.id,
        lineItemId: plan.lineItems[1].id,
        phase: 'assembly',
      }),
      encodePlanLineItemPhaseSelection({
        planId: plan.id,
        lineItemId: plan.lineItems[2].id,
        phase: 'dismantle',
      }),
    ]);
    const inputs = selectedPlanItemsToCreateTaskInputs([plan], selected);

    expect(inputs).toHaveLength(1);
    expect(inputs[0].title).toBe('A2 — Assembly');
  });
});

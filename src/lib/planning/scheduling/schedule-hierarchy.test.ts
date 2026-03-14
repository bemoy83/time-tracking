import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../plan-model';
import { buildSharedRows } from './schedule-hierarchy';

function makePlan(id: string, title: string): Plan {
  return {
    ...createPlan(title),
    id,
  };
}

describe('buildSharedRows', () => {
  it('builds project -> phase -> item rows in deterministic order', () => {
    const planA = makePlan('plan-a', 'Alpha');
    const planB = makePlan('plan-b', 'Beta');

    const aBuild = createLineItem('A Build', 'A Build', 'pcs', 1, 1, 0);
    const aTear = createLineItem('A Tear', 'A Tear', 'pcs', 1, 0, 1);
    const bBuild = createLineItem('B Build', 'B Build', 'pcs', 1, 1, 0);

    planA.lineItems = [aBuild, aTear];
    planB.lineItems = [bBuild];

    const rows = buildSharedRows([planB, planA]);

    expect(rows.map((row) => row.id)).toEqual([
      'project:plan-a',
      'phase:plan-a:assembly',
      `item:plan-a:assembly:${aBuild.id}`,
      'phase:plan-a:dismantle',
      `item:plan-a:dismantle:${aTear.id}`,
      'project:plan-b',
      'phase:plan-b:assembly',
      `item:plan-b:assembly:${bBuild.id}`,
    ]);
  });

  it('marks rows read-only when plan is reviewed', () => {
    const plan = makePlan('plan-ro', 'Read Only');
    plan.status = 'reviewed';
    plan.lineItems = [createLineItem('Reviewed Item', 'Reviewed Item', 'pcs', 1, 1, 0)];

    const rows = buildSharedRows([plan]);

    expect(rows.every((row) => row.readOnly)).toBe(true);
  });
});

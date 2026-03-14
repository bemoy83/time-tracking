import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields } from '../plan-model';
import { applyBulkScheduleAmendment } from './amendments';

function makePlanWithItem() {
  const plan = createPlan('Amendments');
  const item = createLineItem('Rigging', 'Rigging', 'm2', 100, 10, 0);
  plan.lineItems = [item];
  return { plan, item };
}

describe('applyBulkScheduleAmendment', () => {
  it('applies one note/timestamp to all changed rows while preserving computed schedule', () => {
    const { plan: previousPlan, item } = makePlanWithItem();
    const previousItem = previousPlan.lineItems[0];
    previousItem.assemblyScheduledStart = '2026-03-02';
    previousItem.assemblyScheduledEnd = '2026-03-03';
    previousItem.assemblyCrewByDate = { '2026-03-02': 2, '2026-03-03': 2 };

    const nextPlan = {
      ...previousPlan,
      lineItems: previousPlan.lineItems.map((lineItem) => (
        lineItem.id === item.id
          ? {
              ...lineItem,
              assemblyScheduledStart: '2026-03-04',
              assemblyScheduledEnd: '2026-03-05',
              assemblyCrewByDate: { '2026-03-04': 1, '2026-03-05': 2 },
            }
          : lineItem
      )),
    };

    const result = applyBulkScheduleAmendment(
      previousPlan,
      nextPlan,
      [{
        lineItemId: item.id,
        phase: 'assembly',
        scheduledStart: '2026-03-04',
        scheduledEnd: '2026-03-05',
      }],
      'Adjusted by assistant',
    );

    const amended = result.lineItems.find((lineItem) => lineItem.id === item.id)!;
    const pf = getPhaseFields(amended, 'assembly');

    expect(pf.scheduledStart).toBe('2026-03-04');
    expect(pf.scheduledEnd).toBe('2026-03-05');
    expect(pf.crewByDate).toEqual({ '2026-03-04': 1, '2026-03-05': 2 });
    expect(pf.originalScheduledStart).toBe('2026-03-02');
    expect(pf.originalScheduledEnd).toBe('2026-03-03');
    expect(amended.amendmentNote).toBe('Adjusted by assistant');
    expect(amended.amendedAt).toBeTruthy();
    expect(result.updatedAt).toBe(amended.amendedAt);
  });

  it('returns plan unchanged when note is empty or there are no changes', () => {
    const { plan } = makePlanWithItem();

    expect(applyBulkScheduleAmendment(plan, plan, [], 'note')).toBe(plan);
    expect(applyBulkScheduleAmendment(plan, plan, [{
      lineItemId: plan.lineItems[0].id,
      phase: 'assembly',
      scheduledStart: null,
      scheduledEnd: null,
    }], '   ')).toBe(plan);
  });
});

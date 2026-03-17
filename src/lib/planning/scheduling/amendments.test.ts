import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields } from '../plan-model';
import { applyBulkScheduleAmendment, applyScheduleAmendment } from './amendments';

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
    previousItem.assemblyPersonHoursByDate = { '2026-03-02': 16, '2026-03-03': 16 };

    const nextPlan = {
      ...previousPlan,
      lineItems: previousPlan.lineItems.map((lineItem) => (
        lineItem.id === item.id
          ? {
              ...lineItem,
              assemblyScheduledStart: '2026-03-04',
              assemblyScheduledEnd: '2026-03-05',
              assemblyPersonHoursByDate: { '2026-03-04': 8, '2026-03-05': 16 },
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
    expect(pf.personHoursByDate).toEqual({ '2026-03-04': 8, '2026-03-05': 16 });
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

describe('applyScheduleAmendment', () => {
  it('persists effort-only changes when the schedule span stays the same', () => {
    const { plan, item } = makePlanWithItem();
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 12, '2026-03-03': 20 };

    const result = applyScheduleAmendment(
      plan,
      item,
      'assembly',
      '2026-03-02',
      '2026-03-03',
      'Adjusted day split',
      { '2026-03-02': 8, '2026-03-03': 24 },
    );

    const amended = result.lineItems.find((lineItem) => lineItem.id === item.id)!;
    const pf = getPhaseFields(amended, 'assembly');

    expect(pf.scheduledStart).toBe('2026-03-02');
    expect(pf.scheduledEnd).toBe('2026-03-03');
    expect(pf.personHoursByDate).toEqual({ '2026-03-02': 8, '2026-03-03': 24 });
    expect(pf.originalScheduledStart).toBeNull();
    expect(pf.originalScheduledEnd).toBeNull();
    expect(amended.amendmentNote).toBe('Adjusted day split');
    expect(amended.amendedAt).toBeTruthy();
  });
});

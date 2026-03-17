import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields, type Plan } from '../plan-model';
import { setSharedPersonHoursForDate, toggleSharedAssignment } from './shared-schedule-mutations';

function makePlanWithItem(status: Plan['status']): { plan: Plan; itemId: string } {
  const plan = createPlan('Shared Plan');
  plan.status = status;
  plan.defaultCrewSize = 4;
  plan.workCalendar = [
    { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
  ];
  const item = createLineItem('Item', 'Item', 'pcs', 8, 1, 0);
  plan.lineItems = [item];
  return { plan, itemId: item.id };
}

describe('shared-schedule-mutations', () => {
  it('toggles assignment for editable plans', () => {
    const { plan, itemId } = makePlanWithItem('draft');

    const updated = toggleSharedAssignment(plan, itemId, 'assembly', '2026-03-02');
    const item = updated.lineItems.find((lineItem) => lineItem.id === itemId)!;
    const pf = getPhaseFields(item, 'assembly');

    expect(pf.scheduledStart).toBe('2026-03-02');
    expect(pf.scheduledEnd).toBe('2026-03-02');
    expect(pf.personHoursByDate?.['2026-03-02']).toBeGreaterThan(0);
    expect(updated.updatedAt).not.toBe(plan.updatedAt);
  });

  it('returns unchanged reviewed plans', () => {
    const { plan, itemId } = makePlanWithItem('reviewed');
    expect(toggleSharedAssignment(plan, itemId, 'assembly', '2026-03-02')).toBe(plan);
  });

  it('updates person-hours for a scheduled day', () => {
    const { plan, itemId } = makePlanWithItem('draft');
    const scheduled = toggleSharedAssignment(plan, itemId, 'assembly', '2026-03-02');

    const updated = setSharedPersonHoursForDate(scheduled, itemId, 'assembly', '2026-03-02', 5.5);
    const item = updated.lineItems.find((lineItem) => lineItem.id === itemId)!;
    const pf = getPhaseFields(item, 'assembly');

    expect(pf.personHoursByDate).toEqual({ '2026-03-02': 5.5 });
    expect(pf.scheduledStart).toBe('2026-03-02');
    expect(pf.scheduledEnd).toBe('2026-03-02');
  });
});

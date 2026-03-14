import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields, type Plan } from '../plan-model';
import { setSharedCrewForDate, toggleSharedAssignment } from './shared-schedule-mutations';

function makePlanWithItem(status: Plan['status']): { plan: Plan; itemId: string } {
  const plan = createPlan('Shared Plan');
  plan.status = status;
  plan.defaultCrewSize = 4;
  plan.workCalendar = [
    { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
  ];
  const item = createLineItem('Item', 'Item', 'pcs', 8, 1, 0);
  item.assemblyScheduledStart = null;
  item.assemblyScheduledEnd = null;
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
    expect(updated.updatedAt).not.toBe(plan.updatedAt);
  });

  it('returns unchanged reviewed plans for assignment and crew edits', () => {
    const { plan, itemId } = makePlanWithItem('reviewed');

    const toggled = toggleSharedAssignment(plan, itemId, 'assembly', '2026-03-02');
    const crewUpdated = setSharedCrewForDate(plan, itemId, 'assembly', '2026-03-02', 7);

    expect(toggled).toBe(plan);
    expect(crewUpdated).toBe(plan);
  });

  it('updates targeted item crew for editable plans', () => {
    const { plan, itemId } = makePlanWithItem('active');
    const assigned = toggleSharedAssignment(plan, itemId, 'assembly', '2026-03-02');

    const updated = setSharedCrewForDate(assigned, itemId, 'assembly', '2026-03-02', 5);
    const item = updated.lineItems.find((lineItem) => lineItem.id === itemId)!;
    const pf = getPhaseFields(item, 'assembly');

    expect(pf.crewByDate?.['2026-03-02']).toBe(5);
  });

  it('allows crew change on weekend when crew pool calendar overrides plan work calendar', () => {
    // Plan has Saturday as non-work (plan.workCalendar blocks crew changes)
    const plan = createPlan('Shared Plan');
    plan.status = 'draft';
    plan.defaultCrewSize = 4;
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-07'; // includes Sat Mar 7
    plan.workCalendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-07', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null }, // Saturday off
    ];
    const item = createLineItem('Item', 'Item', 'pcs', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-07';
    item.assemblyCrewByDate = { '2026-03-02': 1, '2026-03-07': 1 };
    plan.lineItems = [item];

    // Crew pool has Saturday as work day (user toggled weekends on)
    const crewPoolCalendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-07', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    ];

    const updated = setSharedCrewForDate(plan, item.id, 'assembly', '2026-03-07', 3, crewPoolCalendar);
    const pf = getPhaseFields(updated.lineItems[0]!, 'assembly');

    expect(pf.crewByDate?.['2026-03-07']).toBe(3);
  });
});

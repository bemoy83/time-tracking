import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields } from '../plan-model';
import { runAutoSchedule } from './auto-schedule';
import type { GlobalTagSequence } from '../../tags';

function makePlan() {
  const plan = createPlan('Auto');
  plan.assemblyStartDate = '2026-03-02';
  plan.assemblyEndDate = '2026-03-04';
  plan.defaultCrewSize = 4;
  plan.workCalendar = [
    { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00', crewSize: 4 },
  ];
  return plan;
}

describe('runAutoSchedule', () => {
  it('writes personHoursByDate for scheduled work', () => {
    const plan = makePlan();
    const item = createLineItem('Install', 'Install', 'pcs', 16, 2, 0);
    item.assemblyCrew = 2;
    item.assemblyTimeHours = 4;
    plan.lineItems = [item];

    const { plan: scheduled, report } = runAutoSchedule(plan);
    const pf = getPhaseFields(scheduled.lineItems[0]!, 'assembly');

    expect(report.changed).toHaveLength(1);
    expect(pf.personHoursByDate).toBeTruthy();
    expect(Object.values(pf.personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0)).toBe(8);
    expect(pf.scheduledStart).toBe('2026-03-02');
  });

  it('reports unresolved rows when work cannot be fully placed', () => {
    const plan = makePlan();
    const item = createLineItem('Large', 'Large', 'pcs', 16, 1, 0);
    item.assemblyCrew = 4;
    item.assemblyTimeHours = 30;
    plan.lineItems = [item];

    const { report } = runAutoSchedule(plan);
    expect(report.unresolved.length).toBeGreaterThan(0);
    expect(report.unresolved[0]?.reason).toBe('no_capacity_window');
  });
});

describe('defaultCrewSize floor for preferredCrew', () => {
  it('item with default crew=1 can use full plan capacity when defaultCrewSize is larger', () => {
    // Plan has 8 crew → 64h/day available. Item has assemblyCrew=1 (default).
    // Required = 48h. Without the fix, capped at 8h/day → 6 days.
    // With the fix, preferredCrew = max(1, 8) = 8 → can schedule in 1 day.
    const plan = createPlan('CrewFloor');
    plan.assemblyStartDate = '2026-04-01';
    plan.assemblyEndDate = '2026-04-07';
    plan.defaultCrewSize = 8;
    plan.defaultEfficiency = 1.0;
    plan.workCalendar = [
      { date: '2026-04-01', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-02', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-03', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-04', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-05', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-06', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
      { date: '2026-04-07', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
    ];
    // 6h access × 8 crew = 48h/day available. Item crew=1 (default). Required = 48h.
    const item = createLineItem('Task', 'Task', 'pcs', 1, 1, 0);
    // assemblyCrew left at default (1)
    item.assemblyTimeHours = 48; // 1 crew × 48h = 48h required (single-crew task, lots of hours)
    plan.lineItems = [item];

    const { plan: scheduled } = runAutoSchedule(plan);
    const pf = getPhaseFields(scheduled.lineItems[0]!, 'assembly');
    const daysUsed = Object.keys(pf.personHoursByDate ?? {}).length;

    // With plan crew floor, 48h available/day → fits in 1 day
    expect(daysUsed).toBe(1);
    expect(pf.scheduledStart).toBe('2026-04-01');
  });
});

describe('tag sequence ordering', () => {
  it('schedules items in tag sequence order, not just by size', () => {
    // Two items with identical person-hours requirements.
    // Item A has a tag at sequence position 2 (lower priority).
    // Item B has a tag at sequence position 0 (highest priority).
    // Without tag sequence: A and B sort by ID — alphabetically A comes first.
    // With tag sequence: B must be scheduled first (position 0 < position 2).
    const plan = createPlan('TagSeq');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-04';
    plan.defaultCrewSize = 2;
    plan.workCalendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
      { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
      { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00', crewSize: 2 },
    ];

    const itemA = createLineItem('Alpha', 'Alpha', 'pcs', 1, 1, 0);
    itemA.assemblyCrew = 1;
    itemA.assemblyTimeHours = 8; // 8 ph required
    itemA.tagIds = ['tag-low-priority']; // sequence position 2

    const itemB = createLineItem('Beta', 'Beta', 'pcs', 1, 1, 0);
    itemB.assemblyCrew = 1;
    itemB.assemblyTimeHours = 8; // 8 ph required (same as A)
    itemB.tagIds = ['tag-high-priority']; // sequence position 0

    plan.lineItems = [itemA, itemB];

    const tagSeq: GlobalTagSequence = {
      id: 'global',
      tagIds: ['tag-high-priority', 'tag-mid', 'tag-low-priority'],
      updatedAt: '',
    };

    const { report } = runAutoSchedule(plan, { tagSequence: tagSeq });

    // B (high-priority tag) must appear before A (low-priority tag) in changed[]
    const changedIds = report.changed.map((r) => r.lineItemId);
    expect(changedIds.indexOf(itemB.id)).toBeLessThan(changedIds.indexOf(itemA.id));
  });

  it('falls back to requiredPH ordering when no tagSequence is provided', () => {
    // Existing behavior: larger items are scheduled first.
    const plan = makePlan();
    const small = createLineItem('Small', 'Small', 'pcs', 1, 1, 0);
    small.assemblyCrew = 1;
    small.assemblyTimeHours = 4; // 4 ph

    const large = createLineItem('Large', 'Large', 'pcs', 1, 1, 0);
    large.assemblyCrew = 2;
    large.assemblyTimeHours = 4; // 8 ph — must schedule first

    plan.lineItems = [small, large];

    const { report } = runAutoSchedule(plan); // no tagSequence

    const changedIds = report.changed.map((r) => r.lineItemId);
    expect(changedIds.indexOf(large.id)).toBeLessThan(changedIds.indexOf(small.id));
  });
});

describe('efficiency affects auto-schedule day span', () => {
  it('workload spanning exactly between effective and raw capacity needs more days at 0.8', () => {
    // 28h required: at 1.0 efficiency (raw=32h/day) → fits in 1 day; at 0.8 (usable=25.6h/day) → 2 days
    function makeEfficiencyPlan(efficiency: number | null) {
      const plan = createPlan('Efficiency');
      plan.assemblyStartDate = '2026-04-01';
      plan.assemblyEndDate = '2026-04-05';
      plan.defaultCrewSize = 4;
      plan.defaultEfficiency = efficiency;
      plan.workCalendar = [
        { date: '2026-04-01', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
        { date: '2026-04-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
        { date: '2026-04-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
        { date: '2026-04-04', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
        { date: '2026-04-05', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      ];
      return plan;
    }

    // 28h required: between usable (25.6h at 0.8) and raw (32h at 1.0)
    // At 1.0: day cap = 32h → 28h fits in 1 day
    // At 0.8: day cap = 25.6h → 28h requires 2 days (25.6 + 2.4)
    const plan100 = makeEfficiencyPlan(1.0);
    const item100 = createLineItem('Work', 'Work', 'pcs', 1, 1, 0);
    item100.assemblyCrew = 4;
    item100.assemblyTimeHours = 7; // 4 crew * 7h = 28h required
    plan100.lineItems = [item100];
    const { plan: scheduled100 } = runAutoSchedule(plan100);
    const pf100 = getPhaseFields(scheduled100.lineItems[0]!, 'assembly');
    const days100 = Object.keys(pf100.personHoursByDate ?? {}).length;

    const plan80 = makeEfficiencyPlan(0.8);
    const item80 = createLineItem('Work', 'Work', 'pcs', 1, 1, 0);
    item80.assemblyCrew = 4;
    item80.assemblyTimeHours = 7;
    plan80.lineItems = [item80];
    const { plan: scheduled80 } = runAutoSchedule(plan80);
    const pf80 = getPhaseFields(scheduled80.lineItems[0]!, 'assembly');
    const days80 = Object.keys(pf80.personHoursByDate ?? {}).length;

    expect(days100).toBe(1);
    expect(days80).toBeGreaterThan(days100);
  });
});

import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../plan-model';
import { computeCapacitySummary, computeSharedCapacitySummary } from './capacity';

function makePlan(): Plan {
  return {
    ...createPlan('Capacity Plan'),
    eventStartDate: '2026-03-02',
    eventEndDate: '2026-03-03',
    defaultCrewSize: 4,
    defaultEfficiency: 1.0,
    workCalendar: [
      {
        date: '2026-03-02',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: null,
      },
      {
        date: '2026-03-03',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '12:00',
        crewSize: 2,
      },
    ],
  };
}

describe('computeCapacitySummary', () => {
  it('supports phase-only plans with populated work calendar', () => {
    const plan: Plan = {
      ...createPlan('Phase Plan'),
      eventStartDate: null,
      eventEndDate: null,
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-03',
      dismantleStartDate: '2026-03-04',
      dismantleEndDate: '2026-03-05',
      defaultCrewSize: 3,
      defaultEfficiency: 1.0,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      ],
    };
    const item = createLineItem('Install', 'Install', 'pcs', 8, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 8;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.days).toHaveLength(2);
    expect(summary.totalEffectiveAvailablePersonHours).toBe(48);
    expect(summary.totalRequiredPersonHours).toBe(8);
  });

  it('treats personHoursByDate as schedule truth even when span cache is stale', () => {
    const plan = makePlan();
    const item = createLineItem('Cache Drift', 'Cache Drift', 'pcs', 8, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 8;
    item.assemblyScheduledStart = null;
    item.assemblyScheduledEnd = null;
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);

    expect(summary.totalRequiredPersonHours).toBe(8);
    expect(summary.scheduledLineItemCount).toBe(1);
    expect(summary.unscheduledLineItemCount).toBe(0);
    expect(summary.days[0].requiredPersonHours).toBe(8);
  });

  it('fills days sequentially — Day 1 absorbs work up to its capacity', () => {
    const plan = makePlan();
    // Day 1: 2 crew × 8h = 16h capacity. Day 2: 2 crew × 4h = 8h capacity.
    // 20h total → Day 1 does 16h (full capacity), Day 2 does remaining 4h.
    const item = createLineItem('Install carpet', 'Carpet', 'm2', 20, 2, 0);
    item.assemblyCrew = 2;
    item.assemblyTimeHours = 10; // 2×10 = 20h total
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 16, '2026-03-03': 4 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.totalRequiredPersonHours).toBe(20);
    expect(summary.totalEffectiveAvailablePersonHours).toBe(40); // 32 + 8
    expect(summary.unscheduledLineItemCount).toBe(0);
    // Sequential: Day 1 fills to capacity (16h), Day 2 gets remainder (4h)
    expect(summary.days[0].requiredPersonHours).toBe(16);
    expect(summary.days[1].requiredPersonHours).toBe(4);
  });

  it('completes work on Day 1 when capacity exceeds total', () => {
    const plan: Plan = {
      ...createPlan('Fast Finish'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 10,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 10 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 10 },
      ],
    };
    const item = createLineItem('Rigging', 'Rigging', 'm2', 10, 1, 0);
    item.assemblyCrew = 4;
    item.assemblyTimeHours = 5; // 4×5 = 20h total. Day 1 capacity: 4×8 = 32h → all done Day 1.
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 20 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // All 20h done on Day 1 (capacity 32h > 20h needed)
    expect(summary.days[0].requiredPersonHours).toBe(20);
    expect(summary.days[1].requiredPersonHours).toBe(0);
    expect(summary.days[1].assignedCrewTotal).toBe(0);
    expect(summary.days[0].isOverWorkerCapacity).toBe(false);
  });

  it('tracks unscheduled line items', () => {
    const plan = makePlan();
    plan.lineItems = [createLineItem('No date', 'Lighting', 'pcs', 5, 1, 0)];
    const summary = computeCapacitySummary(plan);
    expect(summary.unscheduledLineItemCount).toBe(1);
    expect(summary.scheduledLineItemCount).toBe(0);
  });

  it('tracks shortfall when total work exceeds total capacity (item cannot complete)', () => {
    // 1 crew × 8h = 8h capacity/day. 20h total, 2 days = 16h capacity. 4h deficit.
    const plan: Plan = {
      ...createPlan('Deficit Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 4,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      ],
    };
    const item = createLineItem('Audio', 'Audio', 'pcs', 5, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 20; // 20h total, 16h total capacity → can't finish
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8, '2026-03-03': 8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Day 1: 8h (full capacity), Day 2: 8h (full capacity), 4h left over
    expect(summary.days[0].requiredPersonHours).toBe(8);
    expect(summary.days[1].requiredPersonHours).toBe(8);
    // isOverWorkerCapacity = assigned crew > available crew (derived from crew display). 1 assigned < 4 available.
    expect(summary.days[1].isOverWorkerCapacity).toBe(false);
    expect(summary.days[0].isOverWorkerCapacity).toBe(false);
    // Day 2 need to meet target = 8h work + 4h deficit = 12h
    expect(summary.days[1].needToMeetTargetPersonHours).toBe(12);
    // Shortfall = just the deficit that didn't fit (4h)
    expect(summary.days[1].shortfallPersonHours).toBe(4);
    expect(summary.days[0].shortfallPersonHours).toBe(0);
  });

  it('flags over-worker when assigned crew exceeds available crew (derived from crew display)', () => {
    // 6 crew assigned but calendar only has 4 available → 6/4 crew = exceeds worker capacity
    const plan: Plan = {
      ...createPlan('Over Crew Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 4,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      ],
    };
    const item = createLineItem('Rigging', 'Rigging', 'm2', 10, 1, 0);
    item.assemblyCrew = 6; // 6 crew assigned
    item.assemblyTimeHours = 8;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 48, '2026-03-03': 48 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Assigned 6 crew > available 4 crew → isOverWorkerCapacity (derived from crew display)
    expect(summary.days[0].isOverWorkerCapacity).toBe(true);
    expect(summary.days[1].isOverWorkerCapacity).toBe(true);
    expect(summary.overWorkerCapacityDayCount).toBe(2);
  });

    it('fills correctly with varying daily effort', () => {
    const plan: Plan = {
      ...createPlan('Varying Crew Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 10,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 10 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 10 },
      ],
    };
    const item = createLineItem('Flooring', 'Flooring', 'm2', 100, 1, 0);
    item.assemblyCrew = 6;
    item.assemblyTimeHours = 10; // 60h total
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    // Day 1: 60h planned, Day 2: 0h planned
    item.assemblyPersonHoursByDate = { '2026-03-02': 60 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Sequential: Day 1 does 60h (capacity 64h > 60h), all done. Day 2 = 0h.
    expect(summary.days[0].requiredPersonHours).toBe(60);
    expect(summary.days[1].requiredPersonHours).toBe(0);
    expect(summary.totalRequiredPersonHours).toBe(60);
  });

  it('does not flag overStaffed when assigned equals available (derived from crew display)', () => {
    // 4 crew assigned, 4 available → 4/4 crew, no excess spare capacity
    const plan: Plan = {
      ...createPlan('At Capacity Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 4,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      ],
    };
    const item = createLineItem('Flooring', 'Flooring', 'm2', 100, 1, 0);
    item.assemblyCrew = 4;
    item.assemblyTimeHours = 8; // 32h total
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 32, '2026-03-03': 32 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // 4/4 crew on both days → no excess (assigned not < available)
    expect(summary.days[0].isOverStaffed).toBe(false);
    expect(summary.days[1].isOverStaffed).toBe(false);
    expect(summary.overStaffedDayCount).toBe(0);
  });

  it('flags overStaffed when assigned is less than available (excess spare capacity, derived from crew display)', () => {
    // 10h total, 2 days, 6 crew each → Day 1: 6×8=48h capacity, 10h required → isOverStaffed true
    const plan: Plan = {
      ...createPlan('Excess Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 6,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 6 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 6 },
      ],
    };
    const item = createLineItem('Rigging', 'Rigging', 'm2', 10, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 10; // 10h total. Day 1: 1×8=8h capacity, does 8h. Day 2: 1×8=8h capacity, does 2h.
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8, '2026-03-03': 2 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // 1/6 crew on both days → excess spare capacity (assigned < available)
    expect(summary.days[0].isOverStaffed).toBe(true);
    expect(summary.days[1].isOverStaffed).toBe(true);
    expect(summary.overStaffedDayCount).toBe(2);
    // Low utilization (1/6 ≈ 17%) → both days count for warning
    expect(summary.overStaffedWarningDayCount).toBe(2);
  });

  it('excludes overstaffed days from warning count when utilization >= 95%', () => {
    // 4 crew. Day 1: 3.8 crew (95%) → isOverStaffed, no warning. Day 2: 0.5 crew (12.5%) → isOverStaffed, warning
    const plan: Plan = {
      ...createPlan('Near-Full Plan'),
      defaultEfficiency: 1.0,
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 4,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      ],
    };
    const item = createLineItem('Rigging', 'Rigging', 'm2', 10, 1, 0);
    item.assemblyCrew = 1;
    // 34.4h total: Day 1: 30.4h (3.8 crew), Day 2: 4h (0.5 crew)
    item.assemblyTimeHours = 34.4;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 30.4, '2026-03-03': 4 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.days[0].isOverStaffed).toBe(true);
    expect(summary.days[1].isOverStaffed).toBe(true);
    expect(summary.overStaffedDayCount).toBe(2);
    expect(summary.overStaffedWarningDayCount).toBe(1); // only Day 2 (12.5% < 95%)
  });

  it('shows balanced capacity when crew matches required exactly', () => {
    // 1 crew × 8h = 8h capacity/day. 16h total, 2 days = 16h capacity. Exact fit.
    const plan: Plan = {
      ...createPlan('Exact Match Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 4,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      ],
    };
    const item = createLineItem('Audio', 'Audio', 'pcs', 5, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 16; // 16h total, 8h capacity/day → fills both days exactly
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8, '2026-03-03': 8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Day 1: 8h (full capacity), Day 2: 8h (remaining)
    expect(summary.days[0].requiredPersonHours).toBe(8);
    expect(summary.days[1].requiredPersonHours).toBe(8);
    expect(summary.days[0].isOverWorkerCapacity).toBe(false);
    expect(summary.days[1].isOverWorkerCapacity).toBe(false);
    // Only last day of item span is a completion day
    expect(summary.days[0].isCompletionDay).toBe(false);
    expect(summary.days[1].isCompletionDay).toBe(true);
  });

  it('does not count crew on non-work days when work spans weekend', () => {
    // Thu Mar 5 - Tue Mar 10: Thu, Fri work days; Sat, Sun off; Mon, Tue work days
    const plan: Plan = {
      ...createPlan('Span Weekend Plan'),
      eventStartDate: '2026-03-05',
      eventEndDate: '2026-03-10',
      defaultCrewSize: 12,
      workCalendar: [
        { date: '2026-03-05', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 12 },
        { date: '2026-03-06', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 12 },
        { date: '2026-03-07', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
        { date: '2026-03-08', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
        { date: '2026-03-09', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 12 },
        { date: '2026-03-10', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 12 },
      ],
    };
    const item = createLineItem('Rigging', 'Rigging', 'm2', 10, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 24; // 24h total spanning Thu–Tue
    item.assemblyScheduledStart = '2026-03-05';
    item.assemblyScheduledEnd = '2026-03-10';
    item.assemblyPersonHoursByDate = { '2026-03-05': 8, '2026-03-06': 8, '2026-03-09': 8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Non-work days (Sat, Sun) should have 0 assigned crew — no work allocated there
    expect(summary.days[2].isWorkDay).toBe(false);
    expect(summary.days[2].assignedCrewTotal).toBe(0);
    expect(summary.days[3].isWorkDay).toBe(false);
    expect(summary.days[3].assignedCrewTotal).toBe(0);
    // Work days: Thu 8h, Fri 8h, Mon 8h = 24h completes the job.
    // With default 100% efficiency: effectiveAccessHours = 8h, crewEquivalent = 8h / 8h = 1
    expect(summary.days[0].assignedCrewTotal).toBe(1);
    expect(summary.days[1].assignedCrewTotal).toBe(1);
    expect(summary.days[4].assignedCrewTotal).toBe(1);
    expect(summary.days[5].assignedCrewTotal).toBe(0);
  });

  it('computes shared capacity across plans using a single crew-pool calendar', () => {
    const planA: Plan = {
      ...createPlan('Plan A'),
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-03',
      dismantleStartDate: '2026-03-05',
      dismantleEndDate: '2026-03-06',
      defaultCrewSize: 2,
    };
    const itemA = createLineItem('A', 'A', 'pcs', 8, 1, 0);
    itemA.assemblyCrew = 1;
    itemA.assemblyTimeHours = 8;
    itemA.assemblyScheduledStart = '2026-03-02';
    itemA.assemblyScheduledEnd = '2026-03-02';
    itemA.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    planA.lineItems = [itemA];

    const planB: Plan = {
      ...createPlan('Plan B'),
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-03',
      dismantleStartDate: '2026-03-05',
      dismantleEndDate: '2026-03-06',
      defaultCrewSize: 3,
    };
    const itemB = createLineItem('B', 'B', 'pcs', 8, 1, 0);
    itemB.assemblyCrew = 1;
    itemB.assemblyTimeHours = 8;
    itemB.assemblyScheduledStart = '2026-03-02';
    itemB.assemblyScheduledEnd = '2026-03-02';
    itemB.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    planB.lineItems = [itemB];

    const summary = computeSharedCapacitySummary({
      calendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      ],
      defaultCrewSize: 1, // 8h available globally
      lineItems: [
        { planId: planA.id, lineItemId: itemA.id, plan: planA, item: itemA, readOnly: false },
        { planId: planB.id, lineItemId: itemB.id, plan: planB, item: itemB, readOnly: false },
      ],
    });

    expect(summary.totalRequiredPersonHours).toBe(16);
    // shared schedule currently uses the same 100% default efficiency as normal capacity.
    expect(summary.totalEffectiveAvailablePersonHours).toBe(8);
    expect(summary.totalRawAvailablePersonHours).toBe(8);
    expect(summary.overAllocatedDayCount).toBe(1);
  });
});

describe('efficiency factor', () => {
  function makeEfficiencyPlan(efficiency: number | null): Plan {
    return {
      ...createPlan('Efficiency Plan'),
      defaultCrewSize: 4,
      defaultEfficiency: efficiency,
      workCalendar: [
        {
          date: '2026-04-01',
          isWorkDay: true,
          accessStart: '08:00',
          accessEnd: '16:00',
          crewSize: null,
        },
      ],
    };
  }

  it('computes raw=32h and effective=25.6h at 0.8 efficiency', () => {
    const plan = makeEfficiencyPlan(0.8);
    const summary = computeCapacitySummary(plan);
    expect(summary.totalRawAvailablePersonHours).toBe(32);
    expect(summary.totalEffectiveAvailablePersonHours).toBe(25.6);
    expect(summary.totalEffectiveAvailablePersonHours).toBe(25.6);
  });

  it('defaults null efficiency to DEFAULT_PLAN_EFFICIENCY', () => {
    const nullPlan = makeEfficiencyPlan(null);
    const explicitPlan = makeEfficiencyPlan(1.0);
    const nullSummary = computeCapacitySummary(nullPlan);
    const explicitSummary = computeCapacitySummary(explicitPlan);
    expect(nullSummary.totalEffectiveAvailablePersonHours).toBe(
      explicitSummary.totalEffectiveAvailablePersonHours,
    );
  });

  it('24h required is NOT over-allocated at 0.8 (effective=25.6)', () => {
    const plan = makeEfficiencyPlan(0.8);
    const item = createLineItem('Work', 'Work', 'pcs', 24, 1, 0);
    item.assemblyCrew = 3;
    item.assemblyTimeHours = 8;
    item.assemblyScheduledStart = '2026-04-01';
    item.assemblyScheduledEnd = '2026-04-01';
    item.assemblyPersonHoursByDate = { '2026-04-01': 24 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.overAllocatedDayCount).toBe(0);
    expect(summary.days[0].isOverAllocated).toBe(false);
  });

  it('28h required IS over-allocated at 0.8 (effective=25.6)', () => {
    const plan = makeEfficiencyPlan(0.8);
    const item = createLineItem('Work', 'Work', 'pcs', 1, 1, 0);
    item.assemblyCrew = 4;
    item.assemblyTimeHours = 7;
    item.assemblyScheduledStart = '2026-04-01';
    item.assemblyScheduledEnd = '2026-04-01';
    item.assemblyPersonHoursByDate = { '2026-04-01': 28 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.overAllocatedDayCount).toBe(1);
    expect(summary.days[0].isOverAllocated).toBe(true);
  });

  it('utilization is computed against effective capacity, not raw', () => {
    const plan = makeEfficiencyPlan(0.8); // effective = 25.6h
    const item = createLineItem('Work', 'Work', 'pcs', 1, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 12.8;
    item.assemblyScheduledStart = '2026-04-01';
    item.assemblyScheduledEnd = '2026-04-01';
    item.assemblyPersonHoursByDate = { '2026-04-01': 12.8 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // 12.8 / 25.6 = 0.5, not 12.8 / 32 = 0.4
    expect(summary.days[0].utilization).toBe(0.5);
  });
});

describe('shared schedule capacity', () => {
  it('uses the same effective capacity as the current shared-schedule implementation', () => {
    const plan1 = {
      ...createPlan('Plan A'),
      defaultCrewSize: 4,
      defaultEfficiency: 1.0, // would be 32h if respected
      workCalendar: [
        {
          date: '2026-04-01',
          isWorkDay: true,
          accessStart: '08:00',
          accessEnd: '16:00',
          crewSize: null,
        },
      ],
    };

    const summary = computeSharedCapacitySummary({
      calendar: plan1.workCalendar,
      defaultCrewSize: 4,
      lineItems: [],
    });

    // shared currently resolves to full raw capacity here: 4 crew * 8h = 32
    expect(summary.totalEffectiveAvailablePersonHours).toBe(32);
    expect(summary.totalRawAvailablePersonHours).toBe(32);
  });
});

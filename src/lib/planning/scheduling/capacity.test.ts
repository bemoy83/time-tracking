import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../plan-model';
import { computeCapacitySummary } from './capacity';

function makePlan(): Plan {
  return {
    ...createPlan('Capacity Plan'),
    eventStartDate: '2026-03-02',
    eventEndDate: '2026-03-03',
    defaultCrewSize: 4,
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
  it('fills days sequentially — Day 1 absorbs work up to its capacity', () => {
    const plan = makePlan();
    // Day 1: 2 crew × 8h = 16h capacity. Day 2: 2 crew × 4h = 8h capacity.
    // 20h total → Day 1 does 16h (full capacity), Day 2 does remaining 4h.
    const item = createLineItem('Install carpet', 'Carpet', 'm2', 'build-up', 20, 2);
    item.crew = 2;
    item.timeHours = 10; // 2×10 = 20h total
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.totalRequiredPersonHours).toBe(20);
    expect(summary.totalAvailablePersonHours).toBe(40); // 32 + 8
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
    const item = createLineItem('Rigging', 'Rigging', 'm2', 'build-up', 10, 1);
    item.crew = 4;
    item.timeHours = 5; // 4×5 = 20h total. Day 1 capacity: 4×8 = 32h → all done Day 1.
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // All 20h done on Day 1 (capacity 32h > 20h needed)
    expect(summary.days[0].requiredPersonHours).toBe(20);
    expect(summary.days[1].requiredPersonHours).toBe(0);
    // Day 2 has no crew assigned (work already complete)
    expect(summary.days[1].assignedCrewTotal).toBe(0);
    expect(summary.days[0].isOverWorkerCapacity).toBe(false);
  });

  it('tracks unscheduled line items', () => {
    const plan = makePlan();
    plan.lineItems = [createLineItem('No date', 'Lighting', 'pcs', 'build-up', 5, 1)];
    const summary = computeCapacitySummary(plan);
    expect(summary.unscheduledLineItemCount).toBe(1);
    expect(summary.scheduledLineItemCount).toBe(0);
  });

  it('flags over-worker when total work exceeds total capacity', () => {
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
    const item = createLineItem('Audio', 'Audio', 'pcs', 'build-up', 5, 1);
    item.crew = 1;
    item.timeHours = 20; // 20h total, 16h total capacity → can't finish
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Day 1: 8h (full capacity), Day 2: 8h (full capacity), 4h left over
    expect(summary.days[0].requiredPersonHours).toBe(8);
    expect(summary.days[1].requiredPersonHours).toBe(8);
    // Last day flagged as over-worker (item can't be completed)
    expect(summary.days[1].isOverWorkerCapacity).toBe(true);
    expect(summary.days[0].isOverWorkerCapacity).toBe(false);
    // Day 2 need to meet target = 8h work + 4h deficit = 12h
    expect(summary.days[1].needToMeetTargetPersonHours).toBe(12);
  });

  it('fills correctly with varying crew via crewByDate', () => {
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
    const item = createLineItem('Flooring', 'Flooring', 'm2', 'build-up', 100, 1);
    item.crew = 6;
    item.timeHours = 10; // 60h total
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    // Day 1: 8 crew × 8h = 64h capacity, Day 2: 4 crew × 8h = 32h
    item.crewByDate = { '2026-03-02': 8, '2026-03-03': 4 };
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    // Sequential: Day 1 does 60h (capacity 64h > 60h), all done. Day 2 = 0h.
    expect(summary.days[0].requiredPersonHours).toBe(60);
    expect(summary.days[1].requiredPersonHours).toBe(0);
    expect(summary.totalRequiredPersonHours).toBe(60);
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
    const item = createLineItem('Audio', 'Audio', 'pcs', 'build-up', 5, 1);
    item.crew = 1;
    item.timeHours = 16; // 16h total, 8h capacity/day → fills both days exactly
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
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
});

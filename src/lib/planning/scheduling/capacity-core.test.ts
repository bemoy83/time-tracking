import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields, getPhaseSpan, type Plan, DEFAULT_PLAN_EFFICIENCY, resolvePlanEfficiency } from '../plan-model';
import { computeCapacityFromNormalizedInput } from './capacity-core';
import { computeCapacitySummary, computeSharedCapacitySummary } from './capacity';
import { getAssignedDates } from './assignment';

describe('capacity-core parity', () => {
  it('matches single-plan wrapper output for representative fixture', () => {
    const plan: Plan = {
      ...createPlan('Parity Plan'),
      eventStartDate: '2026-03-02',
      eventEndDate: '2026-03-03',
      defaultCrewSize: 3,
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 3 },
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00', crewSize: 2 },
      ],
    };

    const scheduled = createLineItem('Scheduled', 'Scheduled', 'pcs', 1, 1, 0);
    scheduled.assemblyCrew = 2;
    scheduled.assemblyTimeHours = 10;
    scheduled.assemblyScheduledStart = '2026-03-02';
    scheduled.assemblyScheduledEnd = '2026-03-03';
    scheduled.assemblyPersonHoursByDate = { '2026-03-02': 16, '2026-03-03': 4 };

    const unscheduled = createLineItem('Unscheduled', 'Unscheduled', 'pcs', 1, 1, 0);

    plan.lineItems = [scheduled, unscheduled];

    const wrapperSummary = computeCapacitySummary(plan);
    const coreSummary = computeCapacityFromNormalizedInput({
      calendar: plan.workCalendar,
      defaultCrewSize: plan.defaultCrewSize,
      efficiency: resolvePlanEfficiency(plan),
      scheduledEntries: [
        {
          item: scheduled,
          phase: 'assembly',
          dates: getAssignedDates(getPhaseFields(scheduled, 'assembly')),
        },
      ],
      scheduledLineItemCount: 1,
      unscheduledLineItemCount: 1,
    });

    expect(wrapperSummary).toEqual(coreSummary);
  });

  it('matches shared wrapper output when phase-window filtering applies', () => {
    const planA = {
      ...createPlan('Plan A'),
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-02',
      dismantleStartDate: '2026-03-03',
      dismantleEndDate: '2026-03-03',
    };

    const itemA = createLineItem('A', 'A', 'pcs', 1, 1, 0);
    itemA.assemblyCrew = 1;
    itemA.assemblyTimeHours = 12;
    itemA.assemblyScheduledStart = '2026-03-02';
    itemA.assemblyScheduledEnd = '2026-03-03';
    itemA.assemblyPersonHoursByDate = { '2026-03-02': 12 };
    planA.lineItems = [itemA];

    const planB = {
      ...createPlan('Plan B'),
      assemblyStartDate: '2026-03-02',
      assemblyEndDate: '2026-03-03',
      dismantleStartDate: '2026-03-03',
      dismantleEndDate: '2026-03-03',
    };

    const itemB = createLineItem('B', 'B', 'pcs', 1, 1, 0);
    itemB.assemblyCrew = 1;
    itemB.assemblyTimeHours = 8;
    itemB.assemblyScheduledStart = '2026-03-02';
    itemB.assemblyScheduledEnd = '2026-03-02';
    itemB.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    planB.lineItems = [itemB];

    const calendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
      { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
    ];

    const input = {
      calendar,
      defaultCrewSize: 2,
      lineItems: [
        { planId: planA.id, lineItemId: itemA.id, plan: planA, item: itemA, readOnly: false },
        { planId: planB.id, lineItemId: itemB.id, plan: planB, item: itemB, readOnly: false },
      ],
    };

    const wrapperSummary = computeSharedCapacitySummary(input);

    const itemAPf = getPhaseFields(itemA, 'assembly');
    const itemBPf = getPhaseFields(itemB, 'assembly');

    const coreSummary = computeCapacityFromNormalizedInput({
      calendar,
      defaultCrewSize: 2,
      efficiency: DEFAULT_PLAN_EFFICIENCY,
      scheduledEntries: [
        {
          item: itemA,
          phase: 'assembly',
          dates: getAssignedDates(itemAPf).filter((date) => {
            const span = getPhaseSpan(planA, 'assembly');
            return span ? date >= span.start && date <= span.end : true;
          }),
        },
        {
          item: itemB,
          phase: 'assembly',
          dates: getAssignedDates(itemBPf).filter((date) => {
            const span = getPhaseSpan(planB, 'assembly');
            return span ? date >= span.start && date <= span.end : true;
          }),
        },
      ],
      scheduledLineItemCount: 2,
      unscheduledLineItemCount: 0,
    });

    expect(wrapperSummary).toEqual(coreSummary);
  });
});

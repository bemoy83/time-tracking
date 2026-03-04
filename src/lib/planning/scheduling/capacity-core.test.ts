import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseSpan, type Plan } from '../plan-model';
import { computeCapacityFromNormalizedInput } from './capacity-core';
import { computeCapacitySummary, computeSharedCapacitySummary } from './capacity';
import { listDateRange } from './work-calendar';

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

    const scheduled = createLineItem('Scheduled', 'Scheduled', 'pcs', 'build-up', 1, 1);
    scheduled.crew = 2;
    scheduled.timeHours = 10;
    scheduled.scheduledStart = '2026-03-02';
    scheduled.scheduledEnd = '2026-03-03';

    const unscheduled = createLineItem('Unscheduled', 'Unscheduled', 'pcs', 'build-up', 1, 1);

    plan.lineItems = [scheduled, unscheduled];

    const wrapperSummary = computeCapacitySummary(plan);
    const coreSummary = computeCapacityFromNormalizedInput({
      calendar: plan.workCalendar,
      defaultCrewSize: plan.defaultCrewSize,
      scheduledEntries: [
        {
          item: scheduled,
          dates: ['2026-03-02', '2026-03-03'],
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
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-02',
      tearDownStartDate: '2026-03-03',
      tearDownEndDate: '2026-03-03',
    };

    const itemA = createLineItem('A', 'A', 'pcs', 'build-up', 1, 1);
    itemA.crew = 1;
    itemA.timeHours = 12;
    itemA.scheduledStart = '2026-03-02';
    itemA.scheduledEnd = '2026-03-03';
    planA.lineItems = [itemA];

    const planB = {
      ...createPlan('Plan B'),
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-03',
      tearDownStartDate: '2026-03-03',
      tearDownEndDate: '2026-03-03',
    };

    const itemB = createLineItem('B', 'B', 'pcs', 'build-up', 1, 1);
    itemB.crew = 1;
    itemB.timeHours = 8;
    itemB.scheduledStart = '2026-03-02';
    itemB.scheduledEnd = '2026-03-02';
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
    const coreSummary = computeCapacityFromNormalizedInput({
      calendar,
      defaultCrewSize: 2,
      scheduledEntries: [
        {
          item: itemA,
          dates: listDateRange(itemA.scheduledStart!, itemA.scheduledEnd!).filter((date) => {
            const span = getPhaseSpan(planA, itemA.buildPhase);
            return span ? date >= span.start && date <= span.end : true;
          }),
        },
        {
          item: itemB,
          dates: listDateRange(itemB.scheduledStart!, itemB.scheduledEnd!).filter((date) => {
            const span = getPhaseSpan(planB, itemB.buildPhase);
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

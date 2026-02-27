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
  it('computes required and available person-hours', () => {
    const plan = makePlan();
    const item = createLineItem('Install carpet', 'Carpet', 'm2', 'build-up', 20, 2);
    item.crew = 2;
    item.timeHours = 10;
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];

    const summary = computeCapacitySummary(plan);
    expect(summary.totalRequiredPersonHours).toBe(20);
    expect(summary.totalAvailablePersonHours).toBe(40); // 32 + 8
    expect(summary.unscheduledLineItemCount).toBe(0);
    expect(summary.days[0].requiredPersonHours).toBe(10);
    expect(summary.days[1].requiredPersonHours).toBe(10);
  });

  it('tracks unscheduled line items', () => {
    const plan = makePlan();
    plan.lineItems = [createLineItem('No date', 'Lighting', 'pcs', 'build-up', 5, 1)];
    const summary = computeCapacitySummary(plan);
    expect(summary.unscheduledLineItemCount).toBe(1);
    expect(summary.scheduledLineItemCount).toBe(0);
  });
});

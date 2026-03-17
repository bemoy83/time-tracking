import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../../../lib/planning/plan-model';
import {
  getPlanScheduleCoverageMetric,
  getSharedScheduleCoverageMetric,
} from './workspace-metrics';

function createScheduledPlan(title: string, hours: number): Plan {
  const plan = createPlan(title);
  plan.defaultCrewSize = 2;
  plan.workCalendar = [
    {
      date: '2026-03-10',
      isWorkDay: true,
      accessStart: '08:00',
      accessEnd: '16:00',
      crewSize: null,
    },
  ];

  const item = createLineItem('Install', 'Install', 'pcs', 8, 1, 0);
  item.assemblyCrew = 1;
  item.assemblyTimeHours = hours;
  item.assemblyScheduledStart = '2026-03-10';
  item.assemblyScheduledEnd = '2026-03-10';
  item.assemblyPersonHoursByDate = { '2026-03-10': hours };
  plan.lineItems = [item];
  return plan;
}

describe('schedule coverage metrics', () => {
  it('closes the ring when all required hours are scheduled', () => {
    const plan = createScheduledPlan('Closed Ring', 8);

    const metric = getPlanScheduleCoverageMetric(plan);

    expect(metric.totalHours).toBe(8);
    expect(metric.scheduledHours).toBe(8);
    expect(metric.unscheduledHours).toBe(0);
    expect(metric.completionRatio).toBe(1);
    expect(metric.isComplete).toBe(true);
  });

  it('keeps the ring open when required work has no schedule', () => {
    const plan = createPlan('Open Ring');
    const item = createLineItem('Audio', 'Audio', 'pcs', 8, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 8;
    plan.lineItems = [item];

    const metric = getPlanScheduleCoverageMetric(plan);

    expect(metric.totalHours).toBe(8);
    expect(metric.scheduledHours).toBe(0);
    expect(metric.unscheduledHours).toBe(8);
    expect(metric.completionRatio).toBe(0);
    expect(metric.isComplete).toBe(false);
  });

  it('computes shared schedule coverage from selected plans and shared required hours', () => {
    const planA = createScheduledPlan('A', 8);
    const planB = createScheduledPlan('B', 4);
    const selected = new Set([planA.id, planB.id]);

    const metric = getSharedScheduleCoverageMetric(
      [planA, planB],
      selected,
      { totalRequiredPersonHours: 9 },
    );

    expect(metric).not.toBeNull();
    expect(metric?.totalHours).toBe(12);
    expect(metric?.scheduledHours).toBe(9);
    expect(metric?.unscheduledHours).toBe(3);
    expect(metric?.completionRatio).toBe(0.75);
    expect(metric?.isComplete).toBe(false);
  });

  it('returns null for shared schedule when no plans are selected', () => {
    const plan = createScheduledPlan('A', 8);
    const metric = getSharedScheduleCoverageMetric([plan], new Set());
    expect(metric).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type WorkCalendarDay } from '../plan-model';
import { buildSharedRows } from './schedule-hierarchy';
import { computeSharedRowAggregates } from './shared-row-aggregates';
import { readPhaseDateValues } from './schedule-span';

function makeCalendar(): WorkCalendarDay[] {
  return [
    { date: '2026-03-01', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
  ];
}

describe('shared-row-aggregates', () => {
  it('computes deterministic project/phase/item rollups', () => {
    const plan = createPlan('A Plan');
    plan.buildUpStartDate = '2026-03-01';
    plan.buildUpEndDate = '2026-03-02';
    plan.tearDownStartDate = '2026-03-03';
    plan.tearDownEndDate = '2026-03-03';

    const item = createLineItem('Rig', 'Rig', 'pcs', 'build-up', 1, 1);
    item.crew = 1;
    item.timeHours = 16;
    item.scheduledStart = '2026-03-01';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];

    const rows = buildSharedRows([plan]);
    const calendar = makeCalendar();
    const dayByDate = new Map(calendar.map((day) => [day.date, { isWorkDay: day.isWorkDay, accessHours: 8 }]));
    const phaseDatesByPlanId = new Map([[plan.id, readPhaseDateValues(plan)]]);
    const itemByCompositeId = new Map([[`${plan.id}:${item.id}`, item]]);

    const result = computeSharedRowAggregates({
      rows,
      calendar,
      itemByCompositeId,
      phaseDatesByPlanId,
      dayByDate,
    });

    const project = result.get(`project:${plan.id}`)!;
    const phase = result.get(`phase:${plan.id}:build-up`)!;
    const itemRow = result.get(`item:${plan.id}:${item.id}`)!;

    // day 3 is outside build-up phase window and therefore filtered out
    expect(itemRow.get('2026-03-01')).toEqual({ requiredHours: 8, assignedCrew: 1 });
    expect(itemRow.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1 });
    expect(itemRow.get('2026-03-03')).toEqual({ requiredHours: 0, assignedCrew: 0 });

    expect(phase.get('2026-03-01')).toEqual(itemRow.get('2026-03-01'));
    expect(phase.get('2026-03-02')).toEqual(itemRow.get('2026-03-02'));
    expect(project.get('2026-03-01')).toEqual(itemRow.get('2026-03-01'));
    expect(project.get('2026-03-02')).toEqual(itemRow.get('2026-03-02'));
  });

  it('handles multi-plan overlap independently by owning plan phase window', () => {
    const planA = createPlan('A Plan');
    planA.buildUpStartDate = '2026-03-01';
    planA.buildUpEndDate = '2026-03-02';
    planA.tearDownStartDate = '2026-03-03';
    planA.tearDownEndDate = '2026-03-03';

    const planB = createPlan('B Plan');
    planB.buildUpStartDate = '2026-03-02';
    planB.buildUpEndDate = '2026-03-03';
    planB.tearDownStartDate = '2026-03-03';
    planB.tearDownEndDate = '2026-03-03';

    const itemA = createLineItem('A Item', 'A Item', 'pcs', 'build-up', 1, 1);
    itemA.crew = 1;
    itemA.timeHours = 16;
    itemA.scheduledStart = '2026-03-01';
    itemA.scheduledEnd = '2026-03-03';

    const itemB = createLineItem('B Item', 'B Item', 'pcs', 'build-up', 1, 1);
    itemB.crew = 1;
    itemB.timeHours = 16;
    itemB.scheduledStart = '2026-03-02';
    itemB.scheduledEnd = '2026-03-03';

    planA.lineItems = [itemA];
    planB.lineItems = [itemB];

    const rows = buildSharedRows([planA, planB]);
    const calendar = makeCalendar();
    const dayByDate = new Map(calendar.map((day) => [day.date, { isWorkDay: day.isWorkDay, accessHours: 8 }]));
    const phaseDatesByPlanId = new Map([
      [planA.id, readPhaseDateValues(planA)],
      [planB.id, readPhaseDateValues(planB)],
    ]);
    const itemByCompositeId = new Map([
      [`${planA.id}:${itemA.id}`, itemA],
      [`${planB.id}:${itemB.id}`, itemB],
    ]);

    const result = computeSharedRowAggregates({
      rows,
      calendar,
      itemByCompositeId,
      phaseDatesByPlanId,
      dayByDate,
    });

    const projectA = result.get(`project:${planA.id}`)!;
    const projectB = result.get(`project:${planB.id}`)!;

    expect(projectA.get('2026-03-01')).toEqual({ requiredHours: 8, assignedCrew: 1 });
    expect(projectA.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1 });
    expect(projectA.get('2026-03-03')).toEqual({ requiredHours: 0, assignedCrew: 0 });

    expect(projectB.get('2026-03-01')).toEqual({ requiredHours: 0, assignedCrew: 0 });
    expect(projectB.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1 });
    expect(projectB.get('2026-03-03')).toEqual({ requiredHours: 8, assignedCrew: 1 });
  });
});

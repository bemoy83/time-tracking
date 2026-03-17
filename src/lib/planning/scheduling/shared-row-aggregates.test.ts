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
    plan.assemblyStartDate = '2026-03-01';
    plan.assemblyEndDate = '2026-03-02';
    plan.dismantleStartDate = '2026-03-03';
    plan.dismantleEndDate = '2026-03-03';

    const item = createLineItem('Rig', 'Rig', 'pcs', 1, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 16;
    item.assemblyScheduledStart = '2026-03-01';
    item.assemblyScheduledEnd = '2026-03-03';
    item.assemblyPersonHoursByDate = { '2026-03-01': 8, '2026-03-02': 8 };
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
    const phase = result.get(`phase:${plan.id}:assembly`)!;
    const itemRow = result.get(`item:${plan.id}:assembly:${item.id}`)!;

    // day 3 is outside assembly phase window and therefore filtered out
    expect(itemRow.get('2026-03-01')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
    expect(itemRow.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
    expect(itemRow.get('2026-03-03')).toEqual({ requiredHours: 0, assignedCrew: 0, assignedCapacityHours: 0, shortfallHours: 0 });

    expect(phase.get('2026-03-01')).toEqual(itemRow.get('2026-03-01'));
    expect(phase.get('2026-03-02')).toEqual(itemRow.get('2026-03-02'));
    expect(project.get('2026-03-01')).toEqual(itemRow.get('2026-03-01'));
    expect(project.get('2026-03-02')).toEqual(itemRow.get('2026-03-02'));
  });

  it('handles multi-plan overlap independently by owning plan phase window', () => {
    const planA = createPlan('A Plan');
    planA.assemblyStartDate = '2026-03-01';
    planA.assemblyEndDate = '2026-03-02';
    planA.dismantleStartDate = '2026-03-03';
    planA.dismantleEndDate = '2026-03-03';

    const planB = createPlan('B Plan');
    planB.assemblyStartDate = '2026-03-02';
    planB.assemblyEndDate = '2026-03-03';
    planB.dismantleStartDate = '2026-03-03';
    planB.dismantleEndDate = '2026-03-03';

    const itemA = createLineItem('A Item', 'A Item', 'pcs', 1, 1, 0);
    itemA.assemblyCrew = 1;
    itemA.assemblyTimeHours = 16;
    itemA.assemblyScheduledStart = '2026-03-01';
    itemA.assemblyScheduledEnd = '2026-03-03';
    itemA.assemblyPersonHoursByDate = { '2026-03-01': 8, '2026-03-02': 8 };

    const itemB = createLineItem('B Item', 'B Item', 'pcs', 1, 1, 0);
    itemB.assemblyCrew = 1;
    itemB.assemblyTimeHours = 16;
    itemB.assemblyScheduledStart = '2026-03-02';
    itemB.assemblyScheduledEnd = '2026-03-03';
    itemB.assemblyPersonHoursByDate = { '2026-03-02': 8, '2026-03-03': 8 };

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

    expect(projectA.get('2026-03-01')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
    expect(projectA.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
    expect(projectA.get('2026-03-03')).toEqual({ requiredHours: 0, assignedCrew: 0, assignedCapacityHours: 0, shortfallHours: 0 });

    expect(projectB.get('2026-03-01')).toEqual({ requiredHours: 0, assignedCrew: 0, assignedCapacityHours: 0, shortfallHours: 0 });
    expect(projectB.get('2026-03-02')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
    expect(projectB.get('2026-03-03')).toEqual({ requiredHours: 8, assignedCrew: 1, assignedCapacityHours: 8, shortfallHours: 0 });
  });
});

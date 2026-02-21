import { describe, it, expect } from 'vitest';
import type { Task, AttributedEntry } from './types';
import { computeWorkTypeKpis } from './kpi';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: 'build-up',
    workCategory: 'carpet-tiles',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAttributedEntry(overrides: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    entryId: 'entry-1',
    taskId: 'task-1',
    ownerTaskId: 'task-1',
    status: 'attributed',
    reason: 'self',
    personHours: 2,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
    ...overrides,
  };
}

describe('computeWorkTypeKpis', () => {
  it('computes productivity from attributed entries', () => {
    const task = makeTask({ id: 't1', workQuantity: 100 });
    const entries = [
      makeAttributedEntry({ entryId: 'e1', taskId: 't1', ownerTaskId: 't1', personHours: 5 }),
      makeAttributedEntry({ entryId: 'e2', taskId: 't1', ownerTaskId: 't1', personHours: 5 }),
    ];

    const entriesByTask = new Map([['t1', entries]]);
    const kpis = computeWorkTypeKpis([task], entriesByTask);

    expect(kpis).toHaveLength(1);
    expect(kpis[0].avgProductivity).toBe(10); // 100 / 10 person-hrs
    expect(kpis[0].totalQuantity).toBe(100);
    expect(kpis[0].totalPersonHours).toBe(10);
    expect(kpis[0].sampleCount).toBe(1);
  });

  it('groups tasks by work type key', () => {
    const t1 = makeTask({ id: 't1', workQuantity: 100, workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' });
    const t2 = makeTask({ id: 't2', workQuantity: 200, workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' });
    const t3 = makeTask({ id: 't3', workQuantity: 50, workCategory: 'furniture', workUnit: 'pcs', buildPhase: 'build-up' });

    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
      ['t2', [makeAttributedEntry({ entryId: 'e2', taskId: 't2', ownerTaskId: 't2', personHours: 20 })]],
      ['t3', [makeAttributedEntry({ entryId: 'e3', taskId: 't3', ownerTaskId: 't3', personHours: 5 })]],
    ]);

    const kpis = computeWorkTypeKpis([t1, t2, t3], entriesByTask);

    expect(kpis).toHaveLength(2);
    // carpet-tiles group: (100+200) / (10+20) = 10
    const carpetKpi = kpis.find((k) => k.key.workCategory === 'carpet-tiles')!;
    expect(carpetKpi.sampleCount).toBe(2);
    expect(carpetKpi.avgProductivity).toBe(10);
    // furniture group: 50 / 5 = 10
    const furnitureKpi = kpis.find((k) => k.key.workCategory === 'furniture')!;
    expect(furnitureKpi.sampleCount).toBe(1);
    expect(furnitureKpi.avgProductivity).toBe(10);
  });

  it('skips non-completed tasks', () => {
    const task = makeTask({ id: 't1', status: 'active' });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ personHours: 5 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis).toHaveLength(0);
  });

  it('skips tasks with no entries', () => {
    const task = makeTask({ id: 't1' });
    const entriesByTask = new Map<string, AttributedEntry[]>();
    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis).toHaveLength(0);
  });
});

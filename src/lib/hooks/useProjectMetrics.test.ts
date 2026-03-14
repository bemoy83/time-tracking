import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { useProjectMetrics } from './useProjectMetrics';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    crew: null,
    targetProductivity: null,
    phase: null,
    workTypeId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

describe('useProjectMetrics', () => {
  it('computes status, time, estimate, budget, and work-quantity metrics', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        status: 'active',
        estimatedMinutes: 60,
        crew: 2,
        workQuantity: 10,
        workUnit: 'm2',
      }),
      makeTask({
        id: 't2',
        status: 'blocked',
        estimatedMinutes: 120,
        crew: 1,
        workQuantity: 5,
        workUnit: 'm2',
      }),
      makeTask({
        id: 't3',
        status: 'completed',
        estimatedMinutes: 60,
        crew: 1,
        workQuantity: 2,
        workUnit: 'orders',
      }),
      makeTask({
        id: 't4',
        status: 'completed',
      }),
    ];

    const metrics = useProjectMetrics(tasks, {
      durationByTask: new Map<string, number>([
        ['t1', 3_600_000],
        ['t2', 1_800_000],
        ['t3', 2_880_000],
        ['t4', 1_200_000],
      ]),
      personMsByTask: new Map<string, number>([
        ['t1', 3_600_000], // under vs 2h estimate
        ['t2', 7_200_000], // over vs 2h estimate
        ['t3', 2_880_000], // approaching vs 1h estimate
        ['t4', 1_800_000], // no estimate
      ]),
    });

    expect(metrics.totalTasks).toBe(4);
    expect(metrics.doneCount).toBe(2);
    expect(metrics.activeCount).toBe(1);
    expect(metrics.blockedCount).toBe(1);
    expect(metrics.totalTimeMs).toBe(9_480_000);
    expect(metrics.personHours).toBe(4.3);
    expect(metrics.estimatedPersonHours).toBe(5);
    expect(metrics.tasksWithEstimate).toBe(3);
    expect(metrics.budgetOverCount).toBe(1);
    expect(metrics.budgetUnderCount).toBe(1);
    expect(metrics.budgetApproachingCount).toBe(1);
    expect(metrics.workQuantityByUnit).toEqual(
      new Map([
        ['m2', 15],
        ['orders', 2],
      ]),
    );
  });

  it('returns null estimate totals and zero budget counts when no task has a valid estimate', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', estimatedMinutes: null, status: 'active' }),
      makeTask({ id: 't2', estimatedMinutes: 0, status: 'blocked' }),
      makeTask({ id: 't3', estimatedMinutes: -10, status: 'completed' }),
    ];

    const metrics = useProjectMetrics(tasks, {
      durationByTask: new Map(),
      personMsByTask: new Map([['t1', 3_600_000]]),
    });

    expect(metrics.estimatedPersonHours).toBeNull();
    expect(metrics.tasksWithEstimate).toBe(0);
    expect(metrics.budgetOverCount).toBe(0);
    expect(metrics.budgetUnderCount).toBe(0);
    expect(metrics.budgetApproachingCount).toBe(0);
  });
});

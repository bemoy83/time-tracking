import { describe, expect, it } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { createLineItem, createPlan, type Plan } from './plan-model';
import { computePlanProgress } from './plan-progress';

function makePlan(): Plan {
  const lineItemA = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 'build-up', 100, 20);
  const lineItemB = createLineItem('Install lights', 'Lighting', 'pcs', 'build-up', 20, 5);
  return {
    ...createPlan('Launch plan'),
    status: 'locked',
    projectId: 'project-1',
    lineItems: [lineItemA, lineItemB],
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: 1,
    targetProductivity: 20,
    buildPhase: 'build-up',
    workTypeId: 'wt-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    startUtc: '2024-01-01T00:00:00.000Z',
    endUtc: '2024-01-01T01:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computePlanProgress', () => {
  it('matches line items by sourceLineItemId and computes planned vs actual values', () => {
    const plan = makePlan();
    const [lineItemA, lineItemB] = plan.lineItems;
    const taskA = makeTask({
      id: 'task-a',
      sourcePlanId: plan.id,
      sourceLineItemId: lineItemA.id,
      status: 'completed',
      workQuantity: 100,
    });
    const taskB = makeTask({
      id: 'task-b',
      sourcePlanId: plan.id,
      sourceLineItemId: lineItemB.id,
      status: 'active',
      workUnit: 'pcs',
      workQuantity: 20,
    });

    const entries = [
      makeEntry({
        id: 'entry-a',
        taskId: 'task-a',
        startUtc: '2024-01-01T00:00:00.000Z',
        endUtc: '2024-01-01T02:00:00.000Z',
        workers: 2,
      }),
      makeEntry({
        id: 'entry-b',
        taskId: 'task-b',
        startUtc: '2024-01-01T00:00:00.000Z',
        endUtc: '2024-01-01T01:00:00.000Z',
        workers: 1,
      }),
    ];

    const progress = computePlanProgress(plan, [taskA, taskB], entries);

    expect(progress.lineItems).toHaveLength(2);
    const itemA = progress.lineItems.find((item) => item.lineItemId === lineItemA.id)!;
    const itemB = progress.lineItems.find((item) => item.lineItemId === lineItemB.id)!;

    expect(itemA.actualHours).toBe(2);
    expect(itemA.actualPersonHours).toBe(4);
    expect(itemA.actualProductivity).toBe(25); // 100 / 4
    expect(itemA.status).toBe('completed');

    expect(itemB.actualHours).toBe(1);
    expect(itemB.actualPersonHours).toBe(1);
    expect(itemB.status).toBe('in-progress');
  });

  it('aggregates unplanned work for tasks in the same project with no sourcePlanId', () => {
    const plan = makePlan();
    const unplanned = makeTask({
      id: 'task-unplanned',
      sourcePlanId: null,
      sourceLineItemId: null,
      projectId: plan.projectId,
    });
    const unrelated = makeTask({
      id: 'task-other-project',
      sourcePlanId: null,
      sourceLineItemId: null,
      projectId: 'project-2',
    });
    const entries = [
      makeEntry({
        id: 'entry-unplanned',
        taskId: unplanned.id,
        startUtc: '2024-01-01T00:00:00.000Z',
        endUtc: '2024-01-01T03:00:00.000Z',
        workers: 2,
      }),
      makeEntry({
        id: 'entry-unrelated',
        taskId: unrelated.id,
        startUtc: '2024-01-01T00:00:00.000Z',
        endUtc: '2024-01-01T04:00:00.000Z',
      }),
    ];

    const progress = computePlanProgress(plan, [unplanned, unrelated], entries);
    expect(progress.unplannedWork.taskCount).toBe(1);
    expect(progress.unplannedWork.hours).toBe(3);
    expect(progress.unplannedWork.personHours).toBe(6);
  });

  it('detects orphan tasks and handles unreleased/not-started line items', () => {
    const plan = makePlan();
    const [lineItemA] = plan.lineItems;
    const orphanTask = makeTask({
      id: 'task-orphan',
      sourcePlanId: plan.id,
      sourceLineItemId: 'missing-line-item',
      status: 'completed',
    });
    const notStartedTask = makeTask({
      id: 'task-not-started',
      sourcePlanId: plan.id,
      sourceLineItemId: lineItemA.id,
      status: 'active',
    });

    const progress = computePlanProgress(plan, [orphanTask, notStartedTask], []);
    expect(progress.orphanTasks.map((task) => task.id)).toEqual(['task-orphan']);

    const lineA = progress.lineItems.find((item) => item.lineItemId === lineItemA.id)!;
    const lineB = progress.lineItems.find((item) => item.lineItemId === plan.lineItems[1].id)!;

    expect(lineA.status).toBe('not-started');
    expect(lineB.status).toBe('unreleased');
    expect(progress.completionRatio).toBe(0.5); // 1 / 2 linked tasks completed
  });
});

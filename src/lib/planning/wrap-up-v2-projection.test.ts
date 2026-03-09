import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLineItem, createPlan, type Plan } from './plan-model';
import type { Task, TimeEntry } from '../types';
import { getLatestExecutionReturnBundleByPlanId } from '../db';
import { loadWrapUpV2Projection } from './wrap-up-v2-projection';
import type { TimeEntriesByTask } from './wrap-up-v2-model';

vi.mock('../db', () => ({
  getLatestExecutionReturnBundleByPlanId: vi.fn(),
}));

const mockGetLatestExecutionReturnBundleByPlanId = vi.mocked(getLatestExecutionReturnBundleByPlanId);

function makePlan(): Plan {
  const plan = createPlan('Wrap-up Phase Plan');
  plan.id = 'plan-1';
  plan.projectId = 'project-1';
  return plan;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: 'm2',
    crew: 1,
    targetProductivity: null,
    buildPhase: 'build-up',
    workTypeId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: 'line-1',
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    startUtc: '2026-01-01T08:00:00.000Z',
    endUtc: '2026-01-01T09:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'synced',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('loadWrapUpV2Projection', () => {
  beforeEach(() => {
    mockGetLatestExecutionReturnBundleByPlanId.mockReset();
    mockGetLatestExecutionReturnBundleByPlanId.mockResolvedValue(null);
  });

  it('treats legacy linked tasks with null buildPhase as build-up', async () => {
    const plan = makePlan();
    const lineItem = createLineItem('Install carpet', 'Carpet', 'm2', 100, 10, 0);
    lineItem.id = 'line-1';
    plan.lineItems = [lineItem];

    const task = makeTask({
      id: 'task-legacy',
      sourceLineItemId: lineItem.id,
      buildPhase: null,
      status: 'completed',
    });
    const entriesByTask: TimeEntriesByTask = new Map([
      [task.id, [makeEntry({ taskId: task.id, endUtc: '2026-01-01T10:00:00.000Z' })]],
    ]);

    const projection = await loadWrapUpV2Projection(plan, [task], entriesByTask);
    const buildUp = projection.lineItems.find((item) => item.phase === 'build-up')!;

    expect(buildUp.linkedTaskIds).toEqual([task.id]);
    expect(buildUp.executionStatus).toBe('completed');
    expect(buildUp.actualPersonHours).toBe(2);
  });

  it('uses tear-down quantity override when computing tear-down productivity', async () => {
    const plan = makePlan();
    const lineItem = createLineItem('Remove carpet', 'Carpet', 'm2', 100, 0, 10);
    lineItem.id = 'line-1';
    lineItem.tearDownQuantity = 40;
    plan.lineItems = [lineItem];

    const task = makeTask({
      id: 'task-teardown',
      sourceLineItemId: lineItem.id,
      buildPhase: 'tear-down',
      status: 'completed',
      workQuantity: 40,
    });
    const entriesByTask: TimeEntriesByTask = new Map([
      [task.id, [makeEntry({
        taskId: task.id,
        startUtc: '2026-01-01T08:00:00.000Z',
        endUtc: '2026-01-01T10:00:00.000Z',
        workers: 2,
      })]],
    ]);

    const projection = await loadWrapUpV2Projection(plan, [task], entriesByTask);
    const tearDown = projection.lineItems.find((item) => item.phase === 'tear-down')!;

    expect(tearDown.actualPersonHours).toBe(4);
    expect(tearDown.actualProductivity).toBe(10);
  });
});


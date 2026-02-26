import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlan, type Plan } from './plan-model';
import { executePlanWrapUp } from './wrap-up';
import type { Task } from '../types';
import { archiveTask } from '../archive/archive-action';
import { getTask, updatePlan, updateTask } from '../db';
import { invalidateAttributionCache } from '../attribution/cache';

vi.mock('../db', () => ({
  getTask: vi.fn(),
  updateTask: vi.fn(),
  updatePlan: vi.fn(),
}));

vi.mock('../archive/archive-action', () => ({
  archiveTask: vi.fn(),
}));

vi.mock('../attribution/cache', () => ({
  invalidateAttributionCache: vi.fn(),
}));

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockUpdatePlan = vi.mocked(updatePlan);
const mockArchiveTask = vi.mocked(archiveTask);
const mockInvalidateAttributionCache = vi.mocked(invalidateAttributionCache);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'completed',
    projectId: 'project-1',
    parentId: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: null,
    workTypeId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

function makePlan(): Plan {
  return {
    ...createPlan('Plan'),
    id: 'plan-1',
    status: 'locked',
    projectId: 'project-1',
    reviewedAt: null,
  };
}

describe('executePlanWrapUp', () => {
  beforeEach(() => {
    mockGetTask.mockReset();
    mockUpdateTask.mockReset();
    mockUpdatePlan.mockReset();
    mockArchiveTask.mockReset();
    mockInvalidateAttributionCache.mockReset();

    mockArchiveTask.mockResolvedValue({
      success: true,
      taskId: 'task-1',
      issues: [],
    });
  });

  it('excludes deselected tasks, archives selected tasks, marks plan reviewed, and invalidates cache', async () => {
    const plan = makePlan();
    mockGetTask.mockResolvedValue(makeTask({ id: 'task-excluded' }));

    const updatedPlan = await executePlanWrapUp({
      plan,
      excludeTaskIds: ['task-excluded'],
      archiveTaskIds: ['task-a', 'task-b'],
      markReviewed: true,
    });

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockUpdateTask.mock.calls[0][0]).toMatchObject({
      id: 'task-excluded',
      excludeFromKpi: true,
    });
    expect(mockArchiveTask).toHaveBeenCalledTimes(2);
    expect(mockArchiveTask).toHaveBeenNthCalledWith(1, 'task-a');
    expect(mockArchiveTask).toHaveBeenNthCalledWith(2, 'task-b');
    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
    expect(updatedPlan.reviewedAt).not.toBeNull();
    expect(mockInvalidateAttributionCache).toHaveBeenCalledTimes(1);
  });

  it('supports review-only mode without marking plan reviewed', async () => {
    const plan = makePlan();
    mockGetTask.mockResolvedValue(makeTask({ id: 'task-excluded' }));

    const updatedPlan = await executePlanWrapUp({
      plan,
      excludeTaskIds: ['task-excluded'],
      archiveTaskIds: ['task-a'],
      markReviewed: false,
    });

    expect(updatedPlan).toEqual(plan);
    expect(mockUpdatePlan).not.toHaveBeenCalled();
    expect(mockArchiveTask).toHaveBeenCalledWith('task-a');
    expect(mockInvalidateAttributionCache).toHaveBeenCalledTimes(1);
  });
});

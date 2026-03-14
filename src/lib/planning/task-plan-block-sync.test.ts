import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types';
import type { Plan } from './plan-model';
import { createLineItem, createPlan } from './plan-model';
import { getAllTasks, getPlan, updatePlan, updateTask } from '../db';
import { nowUtc } from '../types';
import { refreshTasks } from '../stores/task-store';
import {
  syncLineItemBlockToTasks,
  syncLineItemUnblockToTasks,
  syncTaskBlockToPlan,
  syncTaskUnblockToPlan,
} from './task-plan-block-sync';

vi.mock('../db', () => ({
  getAllTasks: vi.fn(),
  getPlan: vi.fn(),
  updatePlan: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../types', async () => {
  const actual = await vi.importActual<typeof import('../types')>('../types');
  return {
    ...actual,
    nowUtc: vi.fn(),
  };
});

vi.mock('../stores/task-store', () => ({
  refreshTasks: vi.fn(),
}));

const mockGetAllTasks = vi.mocked(getAllTasks);
const mockGetPlan = vi.mocked(getPlan);
const mockUpdatePlan = vi.mocked(updatePlan);
const mockUpdateTask = vi.mocked(updateTask);
const mockNowUtc = vi.mocked(nowUtc);
const mockRefreshTasks = vi.mocked(refreshTasks);

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
    workUnit: null,
    crew: null,
    targetProductivity: null,
    phase: null,
    workTypeId: null,
    createdAt: '2026-02-28T08:00:00.000Z',
    updatedAt: '2026-02-28T08:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    sourcePlanId: null,
    sourceLineItemId: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

function makePlan(planId = 'plan-1', lineItemId = 'line-1'): Plan {
  const plan = createPlan('Plan');
  const lineItem = {
    ...createLineItem('Line 1', 'Carpet Tiles', 'm2', 100, 10, 0),
    id: lineItemId,
  };
  return {
    ...plan,
    id: planId,
    status: 'received',
    lineItems: [lineItem],
    updatedAt: '2026-02-28T08:00:00.000Z',
  };
}

describe('task-plan-block-sync', () => {
  beforeEach(() => {
    mockGetAllTasks.mockReset();
    mockGetPlan.mockReset();
    mockUpdatePlan.mockReset();
    mockUpdateTask.mockReset();
    mockRefreshTasks.mockReset();
    mockNowUtc.mockReset();
    mockNowUtc.mockReturnValue('2026-02-28T10:00:00.000Z');
  });

  it('syncTaskBlockToPlan blocks linked plan line item and all linked tasks', async () => {
    const inputTask = makeTask({
      id: 'task-1',
      status: 'blocked',
      blockReason: 'Waiting for materials',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const siblingTask = makeTask({
      id: 'task-2',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const unrelatedTask = makeTask({
      id: 'task-3',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-2',
    });

    mockGetPlan.mockResolvedValue(makePlan());
    mockGetAllTasks.mockResolvedValue([inputTask, siblingTask, unrelatedTask]);

    await syncTaskBlockToPlan(inputTask);

    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
    expect(mockUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            id: 'line-1',
            assemblyExecutionStatus: 'blocked',
            assemblyBlockReason: 'Waiting for materials',
            assemblyBlockCategory: null,
          }),
        ],
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'blocked',
        blockReason: 'Waiting for materials',
        updatedAt: '2026-02-28T10:00:00.000Z',
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        status: 'blocked',
        blockReason: 'Waiting for materials',
        updatedAt: '2026-02-28T10:00:00.000Z',
      }),
    );
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1);
  });

  it('syncTaskUnblockToPlan clears blocked state on line item and linked tasks', async () => {
    const inputTask = makeTask({
      id: 'task-1',
      status: 'active',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const siblingTask = makeTask({
      id: 'task-2',
      status: 'blocked',
      blockReason: 'Waiting for access',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });

    mockGetPlan.mockResolvedValue(
      makePlan('plan-1', 'line-1'),
    );
    mockGetAllTasks.mockResolvedValue([inputTask, siblingTask]);

    await syncTaskUnblockToPlan(inputTask);

    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
    expect(mockUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            id: 'line-1',
            assemblyExecutionStatus: 'pending',
            assemblyBlockReason: null,
            assemblyBlockCategory: null,
          }),
        ],
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'active',
        blockReason: null,
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        status: 'active',
        blockReason: null,
      }),
    );
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1);
  });

  it('syncLineItemBlockToTasks blocks all tasks linked to the line item', async () => {
    const t1 = makeTask({
      id: 'task-1',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const t2 = makeTask({
      id: 'task-2',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const t3 = makeTask({
      id: 'task-3',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-2',
    });
    mockGetAllTasks.mockResolvedValue([t1, t2, t3]);

    await syncLineItemBlockToTasks('plan-1', 'line-1', 'Crew delayed', 'crew');

    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'blocked',
        blockReason: 'Crew delayed',
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        status: 'blocked',
        blockReason: 'Crew delayed',
      }),
    );
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1);
  });

  it('syncLineItemUnblockToTasks clears blocked state for linked tasks', async () => {
    const t1 = makeTask({
      id: 'task-1',
      status: 'blocked',
      blockReason: 'Blocked',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    const t2 = makeTask({
      id: 'task-2',
      status: 'blocked',
      blockReason: 'Blocked',
      sourcePlanId: 'plan-1',
      sourceLineItemId: 'line-1',
    });
    mockGetAllTasks.mockResolvedValue([t1, t2]);

    await syncLineItemUnblockToTasks('plan-1', 'line-1');

    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'active',
        blockReason: null,
      }),
    );
    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        status: 'active',
        blockReason: null,
      }),
    );
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1);
  });

  it('syncTaskBlockToPlan no-ops when linked plan is missing', async () => {
    const inputTask = makeTask({
      id: 'task-1',
      status: 'blocked',
      blockReason: 'No access',
      sourcePlanId: 'plan-missing',
      sourceLineItemId: 'line-1',
    });
    mockGetPlan.mockResolvedValue(null);

    await expect(syncTaskBlockToPlan(inputTask)).resolves.toBeUndefined();

    expect(mockUpdatePlan).not.toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockRefreshTasks).not.toHaveBeenCalled();
  });
});

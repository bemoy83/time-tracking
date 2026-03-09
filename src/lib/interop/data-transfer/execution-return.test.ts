import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../types';
import type { Plan } from '../../planning/plan-model';
import { createLineItem, createPlan } from '../../planning/plan-model';
import { getAllWorkTypes } from '../../db';
import { buildExecutionReturnEnvelope } from './execution-return';

vi.mock('../../db', () => ({
  getAllWorkTypes: vi.fn(),
}));

const mockGetAllWorkTypes = vi.mocked(getAllWorkTypes);

function makePlan(): Plan {
  const base = createPlan('Execution Plan');
  const lineItem = {
    ...createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0),
    id: 'line-1',
    buildUpExecutionStatus: 'pending' as const,
    buildUpBlockReason: null,
  };
  return {
    ...base,
    id: 'plan-1',
    projectId: 'project-1',
    status: 'received',
    lineItems: [lineItem],
  };
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
    workUnit: null,
    crew: null,
    targetProductivity: null,
    buildPhase: null,
    workTypeId: null,
    createdAt: '2026-02-28T08:00:00.000Z',
    updatedAt: '2026-02-28T08:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: 'line-1',
    excludeFromKpi: false,
    ...overrides,
  };
}

describe('buildExecutionReturnEnvelope', () => {
  beforeEach(() => {
    mockGetAllWorkTypes.mockReset();
    mockGetAllWorkTypes.mockResolvedValue([]);
  });

  it('derives blocked line-item status and block reason from linked blocked tasks', async () => {
    const envelope = await buildExecutionReturnEnvelope(
      makePlan(),
      [makeTask({ status: 'blocked', blockReason: 'Access restricted', buildPhase: 'build-up' })],
      [],
    );

    expect(envelope.payload.summary.blocked).toBe(1);
    expect(envelope.payload.lineItems[0]).toMatchObject({
      lineItemId: 'line-1',
      phase: 'build-up',
      executionStatus: 'blocked',
      blockReason: 'Access restricted',
    });
  });

  it('preserves line-item block reason when explicitly set on plan item', async () => {
    const plan = makePlan();
    plan.lineItems[0].buildUpBlockReason = 'From plan item';

    const envelope = await buildExecutionReturnEnvelope(
      plan,
      [makeTask({ status: 'blocked', blockReason: 'From task', buildPhase: 'build-up' })],
      [],
    );

    expect(envelope.payload.lineItems[0]).toMatchObject({
      executionStatus: 'blocked',
      blockReason: 'From plan item',
    });
  });
});

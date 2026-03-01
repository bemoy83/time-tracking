import { describe, expect, it } from 'vitest';
import type { Task } from '../../lib/types';
import { createLineItem } from '../../lib/planning/plan-model';
import { deriveLineItemStatus } from './field-plan-model';

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
    sourcePlanId: null,
    sourceLineItemId: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

describe('deriveLineItemStatus', () => {
  it('returns blocked when any linked task is blocked and item is not explicitly deferred/blocked', () => {
    const item = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 'build-up', 100, 10);
    const status = deriveLineItemStatus(item, [
      makeTask({ id: 'task-1', status: 'active' }),
      makeTask({ id: 'task-2', status: 'blocked', blockReason: 'No materials' }),
    ]);

    expect(status).toBe('blocked');
  });

  it('preserves explicit deferred status over task-derived statuses', () => {
    const item = {
      ...createLineItem('Install carpet', 'Carpet Tiles', 'm2', 'build-up', 100, 10),
      executionStatus: 'deferred' as const,
    };
    const status = deriveLineItemStatus(item, [
      makeTask({ status: 'blocked', blockReason: 'No materials' }),
    ]);

    expect(status).toBe('deferred');
  });
});

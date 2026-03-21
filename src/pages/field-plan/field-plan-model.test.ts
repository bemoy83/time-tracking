import { describe, expect, it } from 'vitest';
import type { Task } from '../../lib/types';
import { createLineItem, getPhaseFields } from '../../lib/planning/plan-model';
import {
  deriveLineItemStatus,
  isLineItemEligibleForRelease,
  type FieldPlanLineItemSummary,
} from './field-plan-model';

function makeSummary(overrides: Partial<FieldPlanLineItemSummary> = {}): FieldPlanLineItemSummary {
  const item = createLineItem('Install', 'Type', 'pcs', 6, 6, 0);
  const phase = 'assembly' as const;
  return {
    item,
    phase,
    phaseFields: getPhaseFields(item, phase),
    tasks: [],
    status: 'pending',
    deadlineStatus: 'unscheduled',
    dueDate: null,
    planId: 'plan-1',
    planTitle: 'Plan',
    planProjectId: 'proj',
    planCanExecute: true,
    ...overrides,
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

describe('deriveLineItemStatus', () => {
  it('returns blocked when any linked task is blocked and item is not explicitly deferred/blocked', () => {
    const item = createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0);
    const pf = getPhaseFields(item, 'assembly');
    const status = deriveLineItemStatus(pf, [
      makeTask({ id: 'task-1', status: 'active' }),
      makeTask({ id: 'task-2', status: 'blocked', blockReason: 'No materials' }),
    ]);

    expect(status).toBe('blocked');
  });

  it('preserves explicit deferred status over task-derived statuses', () => {
    const item = {
      ...createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0),
      assemblyExecutionStatus: 'deferred' as const,
    };
    const pf = getPhaseFields(item, 'assembly');
    const status = deriveLineItemStatus(pf, [
      makeTask({ status: 'blocked', blockReason: 'No materials' }),
    ]);

    expect(status).toBe('deferred');
  });
});

describe('isLineItemEligibleForRelease', () => {
  it('returns true when pending, executable, not removed, and no linked tasks', () => {
    expect(isLineItemEligibleForRelease(makeSummary())).toBe(true);
  });

  it('returns false when plan cannot execute', () => {
    expect(isLineItemEligibleForRelease(makeSummary({ planCanExecute: false }))).toBe(false);
  });

  it('returns false when removed from source', () => {
    const item = createLineItem('Install', 'Type', 'pcs', 6, 6, 0);
    expect(
      isLineItemEligibleForRelease(
        makeSummary({ item: { ...item, removedFromSource: true } }),
      ),
    ).toBe(false);
  });

  it('returns false when status is not pending', () => {
    expect(isLineItemEligibleForRelease(makeSummary({ status: 'blocked' }))).toBe(false);
  });

  it('returns false when there are linked tasks for the phase', () => {
    const base = makeSummary();
    expect(
      isLineItemEligibleForRelease({
        ...base,
        tasks: [
          makeTask({
            sourcePlanId: base.planId,
            sourceLineItemId: base.item.id,
            phase: 'assembly',
          }),
        ],
      }),
    ).toBe(false);
  });
});

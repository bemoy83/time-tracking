import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { createPlan, lockPlan, type Plan } from './plan-model';
import {
  getPlanLinkedTasks,
  getUnplannedProjectTasks,
  isPlanReviewReady,
} from './plan-lifecycle';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    sourcePlanId: null,
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

function makeLockedPlan(): Plan {
  const plan = createPlan('Plan');
  return {
    ...lockPlan(plan),
    projectId: 'project-1',
    reviewedAt: null,
  };
}

describe('isPlanReviewReady', () => {
  it('returns true when locked, not reviewed, linked tasks exist, and all linked tasks are completed', () => {
    const plan = makeLockedPlan();
    const tasks = [
      makeTask({ id: 'a', sourcePlanId: plan.id, status: 'completed' }),
      makeTask({ id: 'b', sourcePlanId: plan.id, status: 'completed' }),
    ];
    expect(isPlanReviewReady(plan, tasks)).toBe(true);
  });

  it('returns false when linked tasks are missing or include non-completed status', () => {
    const plan = makeLockedPlan();
    expect(isPlanReviewReady(plan, [])).toBe(false);
    expect(
      isPlanReviewReady(plan, [makeTask({ sourcePlanId: plan.id, status: 'active' })]),
    ).toBe(false);
  });

  it('returns false for reviewed or draft plans', () => {
    const plan = makeLockedPlan();
    const completed = [makeTask({ sourcePlanId: plan.id, status: 'completed' })];

    expect(
      isPlanReviewReady({ ...plan, reviewedAt: '2024-01-01T00:00:00.000Z' }, completed),
    ).toBe(false);
    expect(isPlanReviewReady({ ...plan, status: 'draft' }, completed)).toBe(false);
  });
});

describe('linked and unplanned helpers', () => {
  it('returns plan-linked tasks by sourcePlanId', () => {
    const plan = makeLockedPlan();
    const linked = makeTask({ id: 'linked', sourcePlanId: plan.id });
    const other = makeTask({ id: 'other', sourcePlanId: 'plan-other' });
    expect(getPlanLinkedTasks(plan, [linked, other]).map((task) => task.id)).toEqual(['linked']);
  });

  it('returns project tasks without source plan as unplanned', () => {
    const plan = makeLockedPlan();
    const unplanned = makeTask({ id: 'unplanned', projectId: plan.projectId, sourcePlanId: null });
    const linked = makeTask({ id: 'linked', projectId: plan.projectId, sourcePlanId: plan.id });
    const otherProject = makeTask({ id: 'other-project', projectId: 'project-2', sourcePlanId: null });

    expect(
      getUnplannedProjectTasks(plan, [unplanned, linked, otherProject]).map((task) => task.id),
    ).toEqual(['unplanned']);
  });
});

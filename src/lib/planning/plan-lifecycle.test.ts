import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { createPlan, activatePlan, type Plan } from './plan-model';
import {
  getPlanLinkedTasks,
  getUnplannedProjectTasks,
  isPlanReviewReady,
  isPlanArchived,
  sortPlansForSidebar,
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

function makeActivePlan(): Plan {
  const plan = createPlan('Plan');
  return {
    ...activatePlan(plan),
    projectId: 'project-1',
    reviewedAt: null,
  };
}

describe('isPlanReviewReady', () => {
  it('returns true when locked, not reviewed, linked tasks exist, and all linked tasks are completed', () => {
    const plan = makeActivePlan();
    const tasks = [
      makeTask({ id: 'a', sourcePlanId: plan.id, status: 'completed' }),
      makeTask({ id: 'b', sourcePlanId: plan.id, status: 'completed' }),
    ];
    expect(isPlanReviewReady(plan, tasks)).toBe(true);
  });

  it('returns false when linked tasks are missing or include non-completed status', () => {
    const plan = makeActivePlan();
    expect(isPlanReviewReady(plan, [])).toBe(false);
    expect(
      isPlanReviewReady(plan, [makeTask({ sourcePlanId: plan.id, status: 'active' })]),
    ).toBe(false);
  });

  it('returns false for reviewed or draft plans', () => {
    const plan = makeActivePlan();
    const completed = [makeTask({ sourcePlanId: plan.id, status: 'completed' })];

    expect(
      isPlanReviewReady({ ...plan, reviewedAt: '2024-01-01T00:00:00.000Z' }, completed),
    ).toBe(false);
    expect(isPlanReviewReady({ ...plan, status: 'draft' }, completed)).toBe(false);
  });
});

describe('isPlanArchived', () => {
  it('returns true when reviewedAt is set', () => {
    const plan = { ...makeActivePlan(), reviewedAt: '2024-06-01T00:00:00.000Z' };
    expect(isPlanArchived(plan)).toBe(true);
  });

  it('returns false when reviewedAt is null', () => {
    const plan = makeActivePlan();
    expect(isPlanArchived(plan)).toBe(false);
  });
});

describe('sortPlansForSidebar', () => {
  it('puts review-ready plans first, then active, then draft', () => {
    const draft = { ...createPlan('Draft'), id: 'draft-1' };
    const active = makeActivePlan();
    active.id = 'active-1';
    const reviewReady = makeActivePlan();
    reviewReady.id = 'review-1';

    const tasks = [
      makeTask({ id: 't1', sourcePlanId: 'review-1', status: 'completed' }),
    ];

    const sorted = sortPlansForSidebar([draft, active, reviewReady], tasks);
    expect(sorted.map((p) => p.id)).toEqual(['review-1', 'active-1', 'draft-1']);
  });

  it('sorts within the same group by date descending (newest first)', () => {
    const older = makeActivePlan();
    older.id = 'older';
    older.activatedAt = '2024-01-01T00:00:00.000Z';

    const newer = makeActivePlan();
    newer.id = 'newer';
    newer.activatedAt = '2024-06-01T00:00:00.000Z';

    const sorted = sortPlansForSidebar([older, newer], []);
    expect(sorted.map((p) => p.id)).toEqual(['newer', 'older']);
  });
});

describe('linked and unplanned helpers', () => {
  it('returns plan-linked tasks by sourcePlanId', () => {
    const plan = makeActivePlan();
    const linked = makeTask({ id: 'linked', sourcePlanId: plan.id });
    const other = makeTask({ id: 'other', sourcePlanId: 'plan-other' });
    expect(getPlanLinkedTasks(plan, [linked, other]).map((task) => task.id)).toEqual(['linked']);
  });

  it('returns project tasks without source plan as unplanned', () => {
    const plan = makeActivePlan();
    const unplanned = makeTask({ id: 'unplanned', projectId: plan.projectId, sourcePlanId: null });
    const linked = makeTask({ id: 'linked', projectId: plan.projectId, sourcePlanId: plan.id });
    const otherProject = makeTask({ id: 'other-project', projectId: 'project-2', sourcePlanId: null });

    expect(
      getUnplannedProjectTasks(plan, [unplanned, linked, otherProject]).map((task) => task.id),
    ).toEqual(['unplanned']);
  });
});

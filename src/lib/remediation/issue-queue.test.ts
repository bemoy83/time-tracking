import { describe, it, expect } from 'vitest';
import type { Task, AttributedEntry } from '../types';
import { buildIssueQueues, findNearestMeasurable } from './issue-queue';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: 'build-up',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    workTypeId: 'wt-default',
    ...overrides,
  };
}

function makeAttributed(overrides: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    entryId: 'entry-1',
    taskId: 'task-1',
    ownerTaskId: 'task-1',
    status: 'attributed',
    reason: 'self',
    personHours: 2,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
    ...overrides,
  };
}

describe('buildIssueQueues', () => {
  it('returns empty queues for fully attributed data', () => {
    const task = makeTask({ id: 't1' });
    const entry = makeAttributed({ taskId: 't1', ownerTaskId: 't1' });

    const result = buildIssueQueues([entry], [task]);

    expect(result.needsMeasurableOwner).toHaveLength(0);
    expect(result.ambiguousOwner).toHaveLength(0);
    expect(result.noWorkContext).toHaveLength(0);
    expect(result.totalIssues).toBe(0);
  });

  it('categorizes unattributed entries without suggestions as needs_measurable_owner', () => {
    const task = makeTask({ id: 't1', workTypeId: null, workUnit: null, workQuantity: null });
    const entry = makeAttributed({
      taskId: 't1',
      status: 'unattributed',
      ownerTaskId: null,
      reason: 'noMeasurableOwner',
      suggestedOwnerTaskId: null,
      personHours: 3,
    });

    const result = buildIssueQueues([entry], [task]);

    expect(result.needsMeasurableOwner).toHaveLength(1);
    expect(result.needsMeasurableOwner[0].entryId).toBe('entry-1');
    expect(result.needsMeasurableOwner[0].personHours).toBe(3);
    expect(result.needsMeasurableOwner[0].suggestionSource).toBeNull();
    expect(result.totalAffectedHours).toBe(3);
  });

  it('categorizes unattributed entries with suggestions as ambiguous_owner', () => {
    const task = makeTask({ id: 't1', workTypeId: null });
    const parent = makeTask({ id: 'parent', workTypeId: 'wt-parent' });
    const entry = makeAttributed({
      taskId: 't1',
      status: 'unattributed',
      ownerTaskId: null,
      reason: 'noMeasurableOwner',
      suggestedOwnerTaskId: 'parent',
      heuristicUsed: 'category-match',
      personHours: 2,
    });

    const result = buildIssueQueues([entry], [task, parent]);

    expect(result.ambiguousOwner).toHaveLength(1);
    expect(result.ambiguousOwner[0].suggestedTargetId).toBe('parent');
    expect(result.ambiguousOwner[0].suggestedTargetTitle).toBe('Test Task');
    expect(result.ambiguousOwner[0].recommendedWorkTypeId).toBe('wt-parent');
    expect(result.ambiguousOwner[0].suggestionSource).toBe('engine');
  });

  it('categorizes ambiguous entries into ambiguous_owner queue', () => {
    const task = makeTask({ id: 't1' });
    const entry = makeAttributed({
      taskId: 't1',
      status: 'ambiguous',
      reason: 'multipleOwners',
      personHours: 4,
    });

    const result = buildIssueQueues([entry], [task]);

    expect(result.ambiguousOwner).toHaveLength(1);
    expect(result.ambiguousOwner[0].personHours).toBe(4);
    expect(result.ambiguousOwner[0].suggestionSource).toBeNull();
  });

  it('adds nearest measurable suggestion for needs_measurable_owner', () => {
    const owner = makeTask({ id: 'owner', title: 'Owner Task', workTypeId: 'wt-owner' });
    const task = makeTask({
      id: 't1',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
      projectId: 'p1',
    });
    const ownerInProject = { ...owner, projectId: 'p1' as const };
    const entry = makeAttributed({
      taskId: 't1',
      status: 'unattributed',
      ownerTaskId: null,
      reason: 'noMeasurableOwner',
      suggestedOwnerTaskId: null,
      personHours: 2,
    });

    const result = buildIssueQueues([entry], [task, ownerInProject]);
    expect(result.needsMeasurableOwner).toHaveLength(1);
    expect(result.needsMeasurableOwner[0].suggestedTargetId).toBe('owner');
    expect(result.needsMeasurableOwner[0].recommendedWorkTypeId).toBe('wt-owner');
    expect(result.needsMeasurableOwner[0].suggestionSource).toBe('nearest');
  });

  it('leaves needs_measurable_owner without suggestion when no target exists', () => {
    const task = makeTask({
      id: 't1',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
    });
    const entry = makeAttributed({
      taskId: 't1',
      status: 'unattributed',
      ownerTaskId: null,
      reason: 'noMeasurableOwner',
      suggestedOwnerTaskId: null,
      personHours: 2,
    });

    const result = buildIssueQueues([entry], [task]);
    expect(result.needsMeasurableOwner).toHaveLength(1);
    expect(result.needsMeasurableOwner[0].suggestedTargetId).toBeNull();
    expect(result.needsMeasurableOwner[0].recommendedWorkTypeId).toBeNull();
    expect(result.needsMeasurableOwner[0].suggestionSource).toBeNull();
  });

  it('detects completed tasks missing work context', () => {
    const task = makeTask({
      id: 't1',
      status: 'completed',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
    });

    const result = buildIssueQueues([], [task]);

    expect(result.noWorkContext).toHaveLength(1);
    expect(result.noWorkContext[0].description).toContain('work type');
    expect(result.noWorkContext[0].description).toContain('work unit');
    expect(result.noWorkContext[0].description).toContain('work quantity');
  });

  it('skips active tasks for no_work_context check', () => {
    const task = makeTask({ id: 't1', status: 'active', workTypeId: null });

    const result = buildIssueQueues([], [task]);
    expect(result.noWorkContext).toHaveLength(0);
  });

  it('skips subtasks for no_work_context check', () => {
    const subtask = makeTask({
      id: 't1',
      parentId: 'parent',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
    });

    const result = buildIssueQueues([], [subtask]);
    expect(result.noWorkContext).toHaveLength(0);
  });

  it('skips measurable completed tasks for no_work_context', () => {
    const task = makeTask({ id: 't1' }); // has all work data

    const result = buildIssueQueues([], [task]);
    expect(result.noWorkContext).toHaveLength(0);
  });

  it('computes total affected hours across all queues', () => {
    const task = makeTask({ id: 't1', workTypeId: null, workUnit: null, workQuantity: null });
    const entries = [
      makeAttributed({
        entryId: 'e1', taskId: 't1', status: 'unattributed',
        ownerTaskId: null, reason: 'noMeasurableOwner', personHours: 3,
      }),
      makeAttributed({
        entryId: 'e2', taskId: 't1', status: 'unattributed',
        ownerTaskId: null, reason: 'noMeasurableOwner', personHours: 5,
      }),
    ];

    const result = buildIssueQueues(entries, [task]);
    expect(result.totalAffectedHours).toBe(8);
  });

  it('groups multiple needs-owner entries by classification scope', () => {
    const task = makeTask({
      id: 't1',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
    });
    const entries = [
      makeAttributed({
        entryId: 'e1',
        taskId: 't1',
        status: 'unattributed',
        ownerTaskId: null,
        reason: 'noMeasurableOwner',
        suggestedOwnerTaskId: null,
        personHours: 2,
      }),
      makeAttributed({
        entryId: 'e2',
        taskId: 't1',
        status: 'unattributed',
        ownerTaskId: null,
        reason: 'noMeasurableOwner',
        suggestedOwnerTaskId: null,
        personHours: 3,
      }),
    ];

    const result = buildIssueQueues(entries, [task]);

    expect(result.needsMeasurableOwner).toHaveLength(1);
    expect(result.needsMeasurableOwner[0].entryId).toBeNull();
    expect(result.needsMeasurableOwner[0].entryIds).toEqual(['e1', 'e2']);
    expect(result.needsMeasurableOwner[0].entryCount).toBe(2);
    expect(result.needsMeasurableOwner[0].personHours).toBe(5);
  });

  it('uses measurable parent as classification scope for grouped issues', () => {
    const parent = makeTask({
      id: 'parent',
      title: 'Parent Scope',
      workTypeId: 'wt-parent',
      workQuantity: 50,
      workUnit: 'm2',
      buildPhase: 'build-up',
    });
    const child = makeTask({
      id: 'child',
      title: 'Child Task',
      parentId: 'parent',
      workTypeId: null,
      workQuantity: null,
      workUnit: null,
      buildPhase: null,
    });
    const entry = makeAttributed({
      entryId: 'e1',
      taskId: 'child',
      status: 'unattributed',
      ownerTaskId: null,
      reason: 'noMeasurableOwner',
      suggestedOwnerTaskId: null,
      personHours: 2,
    });

    const result = buildIssueQueues([entry], [parent, child]);

    expect(result.needsMeasurableOwner).toHaveLength(1);
    expect(result.needsMeasurableOwner[0].taskId).toBe('parent');
    expect(result.needsMeasurableOwner[0].scopeTaskId).toBe('parent');
    expect(result.needsMeasurableOwner[0].taskTitle).toBe('Parent Scope');
    expect(result.needsMeasurableOwner[0].recommendedWorkTypeId).toBe('wt-parent');
  });

  it('marks grouped recommendation conflicts for manual resolution', () => {
    const source = makeTask({
      id: 't1',
      title: 'Source',
      workTypeId: null,
      workUnit: null,
      workQuantity: null,
    });
    const targetA = makeTask({ id: 'target-a', workTypeId: 'wt-a' });
    const targetB = makeTask({ id: 'target-b', workTypeId: 'wt-b' });
    const entries = [
      makeAttributed({
        entryId: 'e1',
        taskId: 't1',
        status: 'unattributed',
        ownerTaskId: null,
        reason: 'noMeasurableOwner',
        suggestedOwnerTaskId: 'target-a',
        personHours: 1,
      }),
      makeAttributed({
        entryId: 'e2',
        taskId: 't1',
        status: 'unattributed',
        ownerTaskId: null,
        reason: 'noMeasurableOwner',
        suggestedOwnerTaskId: 'target-b',
        personHours: 1.5,
      }),
    ];

    const result = buildIssueQueues(entries, [source, targetA, targetB]);

    expect(result.ambiguousOwner).toHaveLength(1);
    expect(result.ambiguousOwner[0].recommendedWorkTypeId).toBeNull();
    expect(result.ambiguousOwner[0].conflictingRecommendedWorkTypeIds).toEqual(['wt-a', 'wt-b']);
    expect(result.ambiguousOwner[0].entryCount).toBe(2);
  });
});

describe('findNearestMeasurable', () => {
  it('returns parent if measurable', () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent', workTypeId: null });

    const result = findNearestMeasurable('child', [parent, child]);

    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('parent');
    expect(result!.matchType).toBe('parent');
  });

  it('returns project peer if no measurable parent', () => {
    const peer = makeTask({ id: 'peer', projectId: 'proj-1' });
    const task = makeTask({
      id: 't1', projectId: 'proj-1',
      workTypeId: null, workUnit: null, workQuantity: null,
    });

    const result = findNearestMeasurable('t1', [peer, task]);

    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('peer');
    expect(result!.matchType).toBe('project_peer');
  });

  it('returns work type match as fallback', () => {
    const match = makeTask({ id: 'match', workTypeId: 'wt-match' });
    const task = makeTask({
      id: 't1',
      workTypeId: 'wt-match',
      workUnit: null, workQuantity: null,
    });

    const result = findNearestMeasurable('t1', [match, task]);

    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('match');
    expect(result!.matchType).toBe('work_type_match');
  });

  it('returns null when no measurable task found', () => {
    const task = makeTask({
      id: 't1',
      workTypeId: null, workUnit: null, workQuantity: null,
    });

    const result = findNearestMeasurable('t1', [task]);
    expect(result).toBeNull();
  });

  it('returns null for non-existent task', () => {
    const result = findNearestMeasurable('nonexistent', []);
    expect(result).toBeNull();
  });
});

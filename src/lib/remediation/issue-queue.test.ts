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
    workCategory: 'carpet-tiles',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
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
    const task = makeTask({ id: 't1', workCategory: null, workUnit: null, workQuantity: null });
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
    expect(result.totalAffectedHours).toBe(3);
  });

  it('categorizes unattributed entries with suggestions as ambiguous_owner', () => {
    const task = makeTask({ id: 't1', workCategory: null });
    const parent = makeTask({ id: 'parent' });
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
  });

  it('detects completed tasks missing work context', () => {
    const task = makeTask({
      id: 't1',
      status: 'completed',
      workCategory: null,
      workUnit: null,
      workQuantity: null,
    });

    const result = buildIssueQueues([], [task]);

    expect(result.noWorkContext).toHaveLength(1);
    expect(result.noWorkContext[0].description).toContain('work category');
    expect(result.noWorkContext[0].description).toContain('work unit');
    expect(result.noWorkContext[0].description).toContain('work quantity');
  });

  it('skips active tasks for no_work_context check', () => {
    const task = makeTask({ id: 't1', status: 'active', workCategory: null });

    const result = buildIssueQueues([], [task]);
    expect(result.noWorkContext).toHaveLength(0);
  });

  it('skips subtasks for no_work_context check', () => {
    const subtask = makeTask({
      id: 't1',
      parentId: 'parent',
      workCategory: null,
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
    const task = makeTask({ id: 't1', workCategory: null, workUnit: null, workQuantity: null });
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
});

describe('findNearestMeasurable', () => {
  it('returns parent if measurable', () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent', workCategory: null });

    const result = findNearestMeasurable('child', [parent, child]);

    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('parent');
    expect(result!.matchType).toBe('parent');
  });

  it('returns project peer if no measurable parent', () => {
    const peer = makeTask({ id: 'peer', projectId: 'proj-1' });
    const task = makeTask({
      id: 't1', projectId: 'proj-1',
      workCategory: null, workUnit: null, workQuantity: null,
    });

    const result = findNearestMeasurable('t1', [peer, task]);

    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('peer');
    expect(result!.matchType).toBe('project_peer');
  });

  it('returns work type match as fallback', () => {
    const match = makeTask({ id: 'match', workCategory: 'carpet-tiles' });
    const task = makeTask({
      id: 't1',
      workCategory: 'carpet-tiles',
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
      workCategory: null, workUnit: null, workQuantity: null,
    });

    const result = findNearestMeasurable('t1', [task]);
    expect(result).toBeNull();
  });

  it('returns null for non-existent task', () => {
    const result = findNearestMeasurable('nonexistent', []);
    expect(result).toBeNull();
  });
});

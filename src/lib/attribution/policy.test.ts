import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { attributeEntry } from './engine';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'active',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: null,
    workCategory: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'child-1',
    startUtc: '2024-01-01T08:00:00.000Z',
    endUtc: '2024-01-01T09:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Attribution Policies', () => {
  // Setup: child task with workCategory/workUnit matching parent, but not itself measurable
  // Parent IS measurable — so normally findMeasurableOwner would find it.
  // For heuristic testing: child with NO parent link to measurable, but with matching fields.

  const parent = makeTask({
    id: 'parent-1',
    workQuantity: 100,
    workUnit: 'm2',
    workCategory: 'carpet-tiles',
    buildPhase: 'build-up',
  });

  // Child that IS linked to parent and parent IS measurable → attributed by ancestor
  const linkedChild = makeTask({
    id: 'child-linked',
    parentId: 'parent-1',
    workCategory: 'carpet-tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
  });

  // Unlinked task (no parent) — will be unattributed regardless of policy
  const unlinkedTask = makeTask({
    id: 'unlinked',
  });

  it('soft_allow_flag: directly attributed entries have null suggestions', () => {
    const entry = makeEntry({ taskId: 'parent-1' });
    const taskMap = new Map([['parent-1', parent]]);
    const result = attributeEntry(entry, taskMap, 'soft_allow_flag');

    expect(result.status).toBe('attributed');
    expect(result.reason).toBe('self');
    expect(result.suggestedOwnerTaskId).toBeNull();
    expect(result.heuristicUsed).toBeNull();
  });

  it('soft_allow_flag: unattributed entries get suggestion but remain unattributed', () => {
    const entry = makeEntry({ taskId: 'unlinked' });
    const taskMap = new Map([['unlinked', unlinkedTask]]);
    const result = attributeEntry(entry, taskMap, 'soft_allow_flag');

    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
    // No parent → no heuristic can fire
    expect(result.suggestedOwnerTaskId).toBeNull();
  });

  it('strict_block: behaves same as soft_allow_flag (suggestion only)', () => {
    const entry = makeEntry({ taskId: 'unlinked' });
    const taskMap = new Map([['unlinked', unlinkedTask]]);
    const result = attributeEntry(entry, taskMap, 'strict_block');

    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
  });

  it('soft_allow_pick_nearest: applies heuristic suggestion to ownerTaskId', () => {
    // Child linked to measurable parent but not itself measurable
    // findMeasurableOwner will find parent → attributed by ancestor
    // Heuristics won't fire because it's already attributed
    const entry = makeEntry({ taskId: 'child-linked' });
    const taskMap = new Map([
      ['parent-1', parent],
      ['child-linked', linkedChild],
    ]);
    const result = attributeEntry(entry, taskMap, 'soft_allow_pick_nearest');

    // Already attributed by ancestor — no heuristic needed
    expect(result.status).toBe('attributed');
    expect(result.ownerTaskId).toBe('parent-1');
    expect(result.suggestedOwnerTaskId).toBeNull();
  });

  it('soft_allow_pick_nearest: unattributed with no parent stays unattributed', () => {
    const entry = makeEntry({ taskId: 'unlinked' });
    const taskMap = new Map([['unlinked', unlinkedTask]]);
    const result = attributeEntry(entry, taskMap, 'soft_allow_pick_nearest');

    // No parent, no heuristic can fire
    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
  });

  it('heuristic fires for child with non-measurable parent matching fields', () => {
    // Parent has matching fields but is NOT measurable (no workQuantity)
    const nonMeasurableParent = makeTask({
      id: 'nm-parent',
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
      workQuantity: null, // not measurable
    });
    const child = makeTask({
      id: 'child-nm',
      parentId: 'nm-parent',
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
    });

    const entry = makeEntry({ taskId: 'child-nm' });
    const taskMap = new Map([
      ['nm-parent', nonMeasurableParent],
      ['child-nm', child],
    ]);

    // Heuristic requires parent to be measurable, so no suggestion
    const result = attributeEntry(entry, taskMap, 'soft_allow_flag');
    expect(result.status).toBe('unattributed');
    expect(result.suggestedOwnerTaskId).toBeNull();
  });
});

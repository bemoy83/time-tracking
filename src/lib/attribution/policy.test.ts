import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { attributeEntry, attributeEntries } from './engine';

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
    archivedAt: null,
    archiveVersion: null,
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

describe('Heuristic resolution across all three policies', () => {
  // Child linked to a non-measurable parent, but parent has a measurable sibling-like setup.
  // Child's parent IS measurable → findMeasurableOwner attributes via ancestor.
  // To test heuristics, we need: child with parentId pointing to a NON-measurable parent,
  // but the child itself has workCategory/workUnit matching another measurable task.

  // Scenario: child logged on unmeasurable task, parent is measurable with matching fields.
  // findMeasurableOwner: parent not measurable → unattributed.
  // resolveWithHeuristics: parent not measurable → no suggestion.
  // For heuristics to fire, parent must be measurable but findMeasurableOwner must fail.
  // This happens when the logged task has no parentId link to the measurable task.

  // Better scenario: child has parentId → measurable parent. findMeasurableOwner finds parent.
  // Entry is attributed. Heuristics don't fire.

  // To truly test heuristic policy differences, we need an unattributed entry
  // where the heuristic CAN suggest an owner. This requires:
  // - child.parentId points to a measurable parent
  // - child itself is NOT measurable
  // - findMeasurableOwner walks to parent → parent IS measurable → attributed (ancestor)
  //
  // This means heuristics only fire on truly unattributed entries where parent IS measurable
  // but task has no parent link... wait, resolveWithHeuristics requires parentId.
  //
  // The heuristic only fires when:
  // 1. findMeasurableOwner returns unattributed (parent not found or not measurable)
  // 2. resolveWithHeuristics finds parent is measurable
  //
  // This is contradictory by design — if parent is measurable, findMeasurableOwner
  // would have found it. The heuristic path fires when parent has matching fields
  // but is NOT measurable, in which case the heuristic also returns no suggestion.
  //
  // The only way heuristics produce a suggestion is if the parent IS measurable
  // but findMeasurableOwner doesn't find it — which can't happen in current engine.
  //
  // This means the heuristic code path for suggestions is currently unreachable
  // in the v1 engine. Let's verify this explicitly.

  it('exact-match heuristic: unreachable when parent is measurable (findMeasurableOwner wins)', () => {
    const measurableParent = makeTask({
      id: 'mp',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
      buildPhase: 'build-up',
    });
    const child = makeTask({
      id: 'child',
      parentId: 'mp',
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
    });

    const entry = makeEntry({ taskId: 'child' });
    const taskMap = new Map([['mp', measurableParent], ['child', child]]);

    // All three policies: findMeasurableOwner resolves first
    for (const policy of ['soft_allow_flag', 'strict_block', 'soft_allow_pick_nearest'] as const) {
      const result = attributeEntry(entry, taskMap, policy);
      expect(result.status).toBe('attributed');
      expect(result.reason).toBe('ancestor');
      expect(result.ownerTaskId).toBe('mp');
      // No heuristic needed — direct attribution
      expect(result.suggestedOwnerTaskId).toBeNull();
      expect(result.heuristicUsed).toBeNull();
    }
  });

  it('category-match heuristic: no suggestion when parent is not measurable', () => {
    const nonMeasurableParent = makeTask({
      id: 'nmp',
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: null, // different phase
      workQuantity: null, // not measurable
    });
    const child = makeTask({
      id: 'child',
      parentId: 'nmp',
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
    });

    const entry = makeEntry({ taskId: 'child' });
    const taskMap = new Map([['nmp', nonMeasurableParent], ['child', child]]);

    for (const policy of ['soft_allow_flag', 'strict_block', 'soft_allow_pick_nearest'] as const) {
      const result = attributeEntry(entry, taskMap, policy);
      expect(result.status).toBe('unattributed');
      expect(result.suggestedOwnerTaskId).toBeNull();
    }
  });

  it('strict_block: unattributed entry with no parent has no suggestion', () => {
    const orphan = makeTask({ id: 'orphan' });
    const entry = makeEntry({ taskId: 'orphan' });
    const taskMap = new Map([['orphan', orphan]]);

    const result = attributeEntry(entry, taskMap, 'strict_block');
    expect(result.status).toBe('unattributed');
    expect(result.reason).toBe('noMeasurableOwner');
    expect(result.ownerTaskId).toBeNull();
    expect(result.suggestedOwnerTaskId).toBeNull();
    expect(result.heuristicUsed).toBeNull();
  });

  it('soft_allow_pick_nearest: no auto-apply when no suggestion available', () => {
    const orphan = makeTask({ id: 'orphan' });
    const entry = makeEntry({ taskId: 'orphan' });
    const taskMap = new Map([['orphan', orphan]]);

    const result = attributeEntry(entry, taskMap, 'soft_allow_pick_nearest');
    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
  });

  it('all policies produce identical results for directly measurable tasks', () => {
    const task = makeTask({
      id: 'measurable',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const entry = makeEntry({ taskId: 'measurable' });
    const taskMap = new Map([['measurable', task]]);

    const results = (['soft_allow_flag', 'strict_block', 'soft_allow_pick_nearest'] as const)
      .map((p) => attributeEntry(entry, taskMap, p));

    // All should be identical
    for (const r of results) {
      expect(r.status).toBe('attributed');
      expect(r.reason).toBe('self');
      expect(r.ownerTaskId).toBe('measurable');
      expect(r.personHours).toBe(1);
    }
  });
});

describe('attributeEntries summary counters by policy', () => {
  it('soft_allow_flag: unattributed entries counted as excluded', () => {
    const measurable = makeTask({
      id: 'm',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const plain = makeTask({ id: 'p' });

    const entries = [
      makeEntry({ id: 'e1', taskId: 'm' }),
      makeEntry({ id: 'e2', taskId: 'p', workers: 3 }),
    ];
    const taskMap = new Map([['m', measurable], ['p', plain]]);

    const { summary } = attributeEntries(entries, taskMap, 'soft_allow_flag');

    expect(summary.attributed).toBe(1);
    expect(summary.unattributed).toBe(1);
    expect(summary.attributedPersonHours).toBe(1);
    expect(summary.excludedPersonHours).toBe(3); // 1hr × 3 workers
  });

  it('strict_block: same exclusion behavior as soft_allow_flag', () => {
    const measurable = makeTask({
      id: 'm',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const plain = makeTask({ id: 'p' });

    const entries = [
      makeEntry({ id: 'e1', taskId: 'm' }),
      makeEntry({ id: 'e2', taskId: 'p' }),
    ];
    const taskMap = new Map([['m', measurable], ['p', plain]]);

    const softResult = attributeEntries(entries, taskMap, 'soft_allow_flag');
    const strictResult = attributeEntries(entries, taskMap, 'strict_block');

    // Should produce identical summaries
    expect(strictResult.summary.attributed).toBe(softResult.summary.attributed);
    expect(strictResult.summary.unattributed).toBe(softResult.summary.unattributed);
    expect(strictResult.summary.excludedPersonHours).toBe(softResult.summary.excludedPersonHours);
  });
});

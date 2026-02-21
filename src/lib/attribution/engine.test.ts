import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import {
  isMeasurable,
  findMeasurableOwner,
  attributeEntry,
  attributeEntries,
  ENGINE_VERSION,
} from './engine';

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
    taskId: 'task-1',
    startUtc: '2024-01-01T08:00:00.000Z',
    endUtc: '2024-01-01T09:00:00.000Z', // 1 hour
    source: 'manual',
    workers: 1,
    syncStatus: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isMeasurable', () => {
  it('returns true when task has quantity, unit, and category', () => {
    const task = makeTask({ workQuantity: 100, workUnit: 'm2', workCategory: 'carpet-tiles' });
    expect(isMeasurable(task)).toBe(true);
  });

  it('returns false when workQuantity is null', () => {
    const task = makeTask({ workQuantity: null, workUnit: 'm2', workCategory: 'carpet-tiles' });
    expect(isMeasurable(task)).toBe(false);
  });

  it('returns false when workQuantity is 0', () => {
    const task = makeTask({ workQuantity: 0, workUnit: 'm2', workCategory: 'carpet-tiles' });
    expect(isMeasurable(task)).toBe(false);
  });

  it('returns false when workUnit is null', () => {
    const task = makeTask({ workQuantity: 100, workUnit: null, workCategory: 'carpet-tiles' });
    expect(isMeasurable(task)).toBe(false);
  });

  it('returns false when workCategory is null', () => {
    const task = makeTask({ workQuantity: 100, workUnit: 'm2', workCategory: null });
    expect(isMeasurable(task)).toBe(false);
  });
});

describe('findMeasurableOwner', () => {
  it('returns self when task is measurable', () => {
    const task = makeTask({ workQuantity: 100, workUnit: 'm2', workCategory: 'carpet-tiles' });
    const result = findMeasurableOwner(task, [task]);
    expect(result).toEqual({ ownerTaskId: 'task-1', status: 'attributed', reason: 'self' });
  });

  it('returns parent when parent is measurable', () => {
    const parent = makeTask({
      id: 'parent-1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const child = makeTask({ id: 'child-1', parentId: 'parent-1' });
    const result = findMeasurableOwner(child, [parent, child]);
    expect(result).toEqual({ ownerTaskId: 'parent-1', status: 'attributed', reason: 'ancestor' });
  });

  it('returns unattributed when no measurable owner exists', () => {
    const task = makeTask();
    const result = findMeasurableOwner(task, [task]);
    expect(result).toEqual({ ownerTaskId: null, status: 'unattributed', reason: 'noMeasurableOwner' });
  });

  it('returns unattributed when parent exists but is not measurable', () => {
    const parent = makeTask({ id: 'parent-1' });
    const child = makeTask({ id: 'child-1', parentId: 'parent-1' });
    const result = findMeasurableOwner(child, [parent, child]);
    expect(result).toEqual({ ownerTaskId: null, status: 'unattributed', reason: 'noMeasurableOwner' });
  });
});

describe('attributeEntry', () => {
  it('attributes entry to self when task is measurable', () => {
    const task = makeTask({ workQuantity: 100, workUnit: 'm2', workCategory: 'carpet-tiles' });
    const entry = makeEntry();
    const taskMap = new Map([['task-1', task]]);
    const result = attributeEntry(entry, taskMap);

    expect(result.status).toBe('attributed');
    expect(result.reason).toBe('self');
    expect(result.ownerTaskId).toBe('task-1');
    expect(result.personHours).toBe(1); // 1 hour × 1 worker
    expect(result.suggestedOwnerTaskId).toBeNull();
    expect(result.heuristicUsed).toBeNull();
  });

  it('computes personHours correctly with multiple workers', () => {
    const task = makeTask({ workQuantity: 100, workUnit: 'm2', workCategory: 'carpet-tiles' });
    const entry = makeEntry({ workers: 3 });
    const taskMap = new Map([['task-1', task]]);
    const result = attributeEntry(entry, taskMap);

    expect(result.personHours).toBe(3); // 1 hour × 3 workers
  });

  it('returns unattributed for unknown task', () => {
    const entry = makeEntry({ taskId: 'unknown' });
    const taskMap = new Map<string, Task>();
    const result = attributeEntry(entry, taskMap);

    expect(result.status).toBe('unattributed');
    expect(result.reason).toBe('noMeasurableOwner');
    expect(result.ownerTaskId).toBeNull();
  });
});

describe('attributeEntries', () => {
  it('produces correct summary for mixed entries', () => {
    const measurable = makeTask({
      id: 'measurable',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const plain = makeTask({ id: 'plain' });

    const entries = [
      makeEntry({ id: 'e1', taskId: 'measurable' }),
      makeEntry({ id: 'e2', taskId: 'plain' }),
      makeEntry({ id: 'e3', taskId: 'measurable', workers: 2 }),
    ];

    const taskMap = new Map([
      ['measurable', measurable],
      ['plain', plain],
    ]);

    const { results, summary } = attributeEntries(entries, taskMap);

    expect(results).toHaveLength(3);
    expect(summary.engineVersion).toBe(ENGINE_VERSION);
    expect(summary.totalEntries).toBe(3);
    expect(summary.attributed).toBe(2);
    expect(summary.unattributed).toBe(1);
    expect(summary.ambiguous).toBe(0);
    expect(summary.totalPersonHours).toBe(4); // 1 + 1 + 2
    expect(summary.attributedPersonHours).toBe(3); // 1 + 2
    expect(summary.excludedPersonHours).toBe(1);
  });

  it('handles empty entries array', () => {
    const { results, summary } = attributeEntries([], new Map());
    expect(results).toHaveLength(0);
    expect(summary.totalEntries).toBe(0);
    expect(summary.attributed).toBe(0);
  });
});

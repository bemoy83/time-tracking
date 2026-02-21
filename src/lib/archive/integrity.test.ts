import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { checkIntegrity, isArchiveReady } from './integrity';

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

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
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

describe('checkIntegrity', () => {
  it('returns empty for valid task with valid entries', () => {
    const task = makeTask();
    const entry = makeEntry();
    expect(checkIntegrity([task], [entry])).toEqual([]);
  });

  it('detects missing work data on completed tasks', () => {
    const task = makeTask({ workCategory: null, workUnit: null });
    const issues = checkIntegrity([task], []);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('missing_work_data');
    expect(issues[0].message).toContain('workCategory');
    expect(issues[0].message).toContain('workUnit');
  });

  it('skips work data check for non-completed tasks', () => {
    const task = makeTask({ status: 'active', workCategory: null });
    expect(checkIntegrity([task], [])).toEqual([]);
  });

  it('detects broken parent links', () => {
    const task = makeTask({ parentId: 'nonexistent' });
    const issues = checkIntegrity([task], []);

    const broken = issues.find((i) => i.type === 'broken_parent_link');
    expect(broken).toBeDefined();
    expect(broken!.severity).toBe('error');
  });

  it('allows valid parent links', () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent' });
    const issues = checkIntegrity([parent, child], []);

    expect(issues.filter((i) => i.type === 'broken_parent_link')).toHaveLength(0);
  });

  it('detects duplicate entries', () => {
    const e1 = makeEntry({ id: 'e1' });
    const e2 = makeEntry({ id: 'e2' }); // same taskId, startUtc, endUtc
    const issues = checkIntegrity([makeTask()], [e1, e2]);

    const dupes = issues.filter((i) => i.type === 'duplicate_entry');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe('error');
  });

  it('does not flag entries with different times as duplicates', () => {
    const e1 = makeEntry({ id: 'e1', startUtc: '2024-01-01T08:00:00.000Z' });
    const e2 = makeEntry({ id: 'e2', startUtc: '2024-01-01T10:00:00.000Z', endUtc: '2024-01-01T11:00:00.000Z' });
    const issues = checkIntegrity([makeTask()], [e1, e2]);

    expect(issues.filter((i) => i.type === 'duplicate_entry')).toHaveLength(0);
  });

  it('detects zero-duration entries', () => {
    const entry = makeEntry({
      startUtc: '2024-01-01T08:00:00.000Z',
      endUtc: '2024-01-01T08:00:00.000Z', // same time
    });
    const issues = checkIntegrity([makeTask()], [entry]);

    const zeroDuration = issues.find((i) => i.type === 'zero_duration_entry');
    expect(zeroDuration).toBeDefined();
    expect(zeroDuration!.message).toContain('zero');
  });

  it('detects orphaned entries', () => {
    const entry = makeEntry({ taskId: 'nonexistent' });
    const issues = checkIntegrity([makeTask()], [entry]);

    const orphaned = issues.find((i) => i.type === 'orphaned_entry');
    expect(orphaned).toBeDefined();
    expect(orphaned!.severity).toBe('error');
  });

  it('returns multiple issues', () => {
    const task = makeTask({ workCategory: null, parentId: 'ghost' });
    const entry = makeEntry({ taskId: 'orphan-ref' });

    const issues = checkIntegrity([task], [entry]);
    expect(issues.length).toBeGreaterThanOrEqual(3); // missing_work_data + broken_parent + orphaned
  });
});

describe('isArchiveReady', () => {
  it('returns ready for clean task', () => {
    const task = makeTask();
    const entry = makeEntry();
    const { ready, issues } = isArchiveReady(task, [], [entry]);

    expect(ready).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it('returns not ready when task has errors', () => {
    const task = makeTask();
    const entry = makeEntry({
      startUtc: '2024-01-01T08:00:00.000Z',
      endUtc: '2024-01-01T08:00:00.000Z',
    });
    const { ready } = isArchiveReady(task, [], [entry]);

    expect(ready).toBe(false);
  });

  it('returns ready with warnings only (missing work data)', () => {
    const task = makeTask({ workCategory: null });
    const { ready, issues } = isArchiveReady(task, [], []);

    // missing_work_data is a warning, not an error
    expect(ready).toBe(true);
    expect(issues.some((i) => i.type === 'missing_work_data')).toBe(true);
  });
});

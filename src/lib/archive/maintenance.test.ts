import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { runMaintenanceScan } from './maintenance';

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

describe('runMaintenanceScan', () => {
  it('returns clean report for healthy data', () => {
    const task = makeTask({
      id: 't1',
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });
    const entry = makeEntry({ taskId: 't1' });
    const entriesByTask = new Map([['t1', [entry]]]);

    const report = runMaintenanceScan([task], entriesByTask);

    expect(report.archivedIssues).toHaveLength(0);
    expect(report.archiveCandidates).toHaveLength(0);
    expect(report.blockedFromArchival).toHaveLength(0);
    expect(report.archivedCount).toBe(1);
    expect(report.pendingCount).toBe(0);
  });

  it('detects issues in archived tasks', () => {
    const task = makeTask({
      id: 't1',
      workCategory: null, // missing work data
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });

    const report = runMaintenanceScan([task], new Map());

    expect(report.archivedIssues.length).toBeGreaterThan(0);
    expect(report.archivedIssues[0].action).toBe('add_work_data');
  });

  it('identifies archival candidates (completed, no errors)', () => {
    const task = makeTask({ id: 't1' });
    const entry = makeEntry({ taskId: 't1' });
    const entriesByTask = new Map([['t1', [entry]]]);

    const report = runMaintenanceScan([task], entriesByTask);

    expect(report.archiveCandidates).toContain('t1');
    expect(report.pendingCount).toBe(1);
  });

  it('flags tasks blocked from archival by errors', () => {
    const task = makeTask({ id: 't1' });
    // zero-duration entry = error
    const entry = makeEntry({
      taskId: 't1',
      startUtc: '2024-01-01T08:00:00.000Z',
      endUtc: '2024-01-01T08:00:00.000Z',
    });
    const entriesByTask = new Map([['t1', [entry]]]);

    const report = runMaintenanceScan([task], entriesByTask);

    expect(report.blockedFromArchival).toHaveLength(1);
    expect(report.blockedFromArchival[0].taskId).toBe('t1');
    expect(report.archiveCandidates).not.toContain('t1');
  });

  it('skips active tasks entirely', () => {
    const active = makeTask({ id: 't1', status: 'active' });
    const report = runMaintenanceScan([active], new Map());

    expect(report.archivedCount).toBe(0);
    expect(report.pendingCount).toBe(0);
    expect(report.archiveCandidates).toHaveLength(0);
  });

  it('handles mixed archived and pending tasks', () => {
    const archived = makeTask({
      id: 't1',
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });
    const pending = makeTask({ id: 't2' });
    const entry = makeEntry({ id: 'e1', taskId: 't1' });
    const entry2 = makeEntry({ id: 'e2', taskId: 't2' });
    const entriesByTask = new Map([
      ['t1', [entry]],
      ['t2', [entry2]],
    ]);

    const report = runMaintenanceScan([archived, pending], entriesByTask);

    expect(report.archivedCount).toBe(1);
    expect(report.pendingCount).toBe(1);
    expect(report.archiveCandidates).toContain('t2');
  });

  it('generates repair suggestions with correct action types', () => {
    const archived = makeTask({
      id: 't1',
      parentId: 'nonexistent', // broken parent link
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });

    const report = runMaintenanceScan([archived], new Map());

    const parentFix = report.archivedIssues.find((s) => s.action === 'fix_parent_link');
    expect(parentFix).toBeDefined();
    expect(parentFix!.description).toContain('parent');
  });
});

/**
 * Tests for buildAttributedRollup — the bridge between raw DB entries
 * and attribution-engine-backed grouping consumed by KPI and Calculator.
 *
 * Uses vi.mock to stub DB fetches; attribution engine runs for real
 * since it's pure and deterministic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, TimeEntry } from './types';
import { buildAttributedRollup } from './attributed-rollup';

// --- stub DB layer ---
vi.mock('./db', () => ({
  getTimeEntriesByTask: vi.fn(),
}));

import { getTimeEntriesByTask } from './db';
const mockGetEntries = vi.mocked(getTimeEntriesByTask);

// --- factories ---
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'completed',
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

beforeEach(() => {
  mockGetEntries.mockReset();
});

describe('buildAttributedRollup', () => {
  it('groups entries by ownerTaskId for qualifying measurable tasks', async () => {
    const parent = makeTask({
      id: 'parent-1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
      buildPhase: 'build-up',
    });
    const child = makeTask({
      id: 'child-1',
      parentId: 'parent-1',
    });

    const parentEntry = makeEntry({ id: 'e1', taskId: 'parent-1' });
    const childEntry = makeEntry({ id: 'e2', taskId: 'child-1' });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent-1') return [parentEntry];
      if (taskId === 'child-1') return [childEntry];
      return [];
    });

    const result = await buildAttributedRollup([parent], [parent, child]);

    // Both entries should be owned by parent-1 (child attributed to parent via ancestor)
    const parentEntries = result.entriesByTask.get('parent-1');
    expect(parentEntries).toHaveLength(2);
    expect(result.summary.attributed).toBe(2);
    expect(result.summary.unattributed).toBe(0);
    expect(result.summary.totalPersonHours).toBe(2);
  });

  it('returns correct summary metrics', async () => {
    const measurable = makeTask({
      id: 't1',
      workQuantity: 50,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const unmeasurable = makeTask({ id: 't2' });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 't1') return [makeEntry({ id: 'e1', taskId: 't1', workers: 2 })];
      if (taskId === 't2') return [makeEntry({ id: 'e2', taskId: 't2' })];
      return [];
    });

    const result = await buildAttributedRollup(
      [measurable, unmeasurable],
      [measurable, unmeasurable],
    );

    expect(result.summary.totalEntries).toBe(2);
    expect(result.summary.attributed).toBe(1);
    expect(result.summary.unattributed).toBe(1);
    expect(result.summary.attributedPersonHours).toBe(2); // 1hr × 2 workers
    expect(result.summary.excludedPersonHours).toBe(1);   // 1hr × 1 worker
  });

  it('handles empty entries gracefully', async () => {
    const task = makeTask({
      id: 't1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });

    mockGetEntries.mockResolvedValue([]);

    const result = await buildAttributedRollup([task], [task]);

    expect(result.entriesByTask.size).toBe(0);
    expect(result.summary.totalEntries).toBe(0);
    expect(result.allAttributed).toHaveLength(0);
  });

  it('does not include entries owned by non-qualifying tasks in entriesByTask', async () => {
    const qualifying = makeTask({
      id: 'q1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const other = makeTask({
      id: 'other',
      workQuantity: 200,
      workUnit: 'm',
      workCategory: 'partition-walls',
    });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 'q1') return [makeEntry({ id: 'e1', taskId: 'q1' })];
      return [];
    });

    // Only q1 is qualifying, other is not passed as qualifying
    const result = await buildAttributedRollup([qualifying], [qualifying, other]);

    expect(result.entriesByTask.has('q1')).toBe(true);
    expect(result.entriesByTask.has('other')).toBe(false);
    expect(result.allAttributed).toHaveLength(1);
  });

  it('fetches entries for subtasks of qualifying tasks', async () => {
    const parent = makeTask({
      id: 'p1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
    });
    const sub1 = makeTask({ id: 's1', parentId: 'p1' });
    const sub2 = makeTask({ id: 's2', parentId: 'p1' });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 's1') return [makeEntry({ id: 'e1', taskId: 's1' })];
      if (taskId === 's2') return [makeEntry({ id: 'e2', taskId: 's2' })];
      return [];
    });

    const result = await buildAttributedRollup([parent], [parent, sub1, sub2]);

    // Both subtask entries should be attributed to parent
    expect(result.entriesByTask.get('p1')).toHaveLength(2);
    expect(result.summary.attributed).toBe(2);
  });
});

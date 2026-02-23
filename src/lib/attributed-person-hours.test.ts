/**
 * Tests for getAttributedPersonHoursForTask — orchestrator that combines
 * buildAttributedRollup with active timer contribution.
 *
 * Stubs DB layer; attribution engine runs for real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, TimeEntry, ActiveTimer } from './types';
import { getAttributedPersonHoursForTask } from './attributed-person-hours';

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
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    workTypeId: null,
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

function makeTimer(overrides: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    id: 'timer-1',
    taskId: 'task-1',
    startUtc: new Date(Date.now() - 3_600_000).toISOString(),
    source: 'manual',
    workers: 1,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetEntries.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-06-15T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getAttributedPersonHoursForTask', () => {
  it('returns person-ms from entries attributed to the task', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent') return [makeEntry({ id: 'e1', taskId: 'parent', workers: 1 })];
      return [];
    });

    const result = await getAttributedPersonHoursForTask(
      'parent',
      [],
      [parent],
      [],
    );

    // 1 entry × 1 hour × 1 worker = 1 person-hour = 3_600_000 ms
    expect(result).toBe(3_600_000);
  });

  it('includes unmeasurable subtask entries attributed to parent', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const child = makeTask({
      id: 'child',
      parentId: 'parent',
    });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent') return [makeEntry({ id: 'e1', taskId: 'parent' })];
      if (taskId === 'child') return [makeEntry({ id: 'e2', taskId: 'child' })];
      return [];
    });

    const result = await getAttributedPersonHoursForTask(
      'parent',
      ['child'],
      [parent, child],
      [],
    );

    // 2 entries × 1 hour × 1 worker = 2 person-hours = 7_200_000 ms
    expect(result).toBe(7_200_000);
  });

  it('excludes measurable subtask entries (they own themselves)', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const measurableChild = makeTask({
      id: 'child',
      parentId: 'parent',
      workQuantity: 50,
      workUnit: 'm2',
      workTypeId: 'wt-child',
    });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent') return [makeEntry({ id: 'e1', taskId: 'parent' })];
      if (taskId === 'child') return [makeEntry({ id: 'e2', taskId: 'child' })];
      return [];
    });

    const result = await getAttributedPersonHoursForTask(
      'parent',
      ['child'],
      [parent, measurableChild],
      [],
    );

    // Only parent entry attributed to parent; child entry is self-owned
    expect(result).toBe(3_600_000);
  });

  it('includes active timer contribution from subtask attributed to parent', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const child = makeTask({
      id: 'child',
      parentId: 'parent',
    });

    mockGetEntries.mockResolvedValue([]);

    const timer = makeTimer({
      taskId: 'child',
      startUtc: '2024-06-15T09:00:00.000Z', // 1 hour ago
      workers: 2,
    });

    const result = await getAttributedPersonHoursForTask(
      'parent',
      ['child'],
      [parent, child],
      [timer],
    );

    // No entries, but timer: 1hr × 2 workers = 7_200_000 person-ms
    expect(result).toBe(7_200_000);
  });

  it('returns 0 when task not found in allTasks', async () => {
    const result = await getAttributedPersonHoursForTask(
      'nonexistent',
      [],
      [],
      [],
    );

    expect(result).toBe(0);
  });

  it('handles multi-worker entries correctly', async () => {
    const task = makeTask({
      id: 't1',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });

    mockGetEntries.mockImplementation(async (taskId: string) => {
      if (taskId === 't1') return [makeEntry({ id: 'e1', taskId: 't1', workers: 3 })];
      return [];
    });

    const result = await getAttributedPersonHoursForTask(
      't1',
      [],
      [task],
      [],
    );

    // 1 hour × 3 workers = 3 person-hours = 10_800_000 ms
    expect(result).toBe(10_800_000);
  });
});

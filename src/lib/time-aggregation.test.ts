import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, TimeEntry, ActiveTimer } from './types';
import { getTaskTimeBreakdownAttribution } from './time-aggregation';

vi.mock('./db', () => ({
  getTimeEntriesByTask: vi.fn(),
}));

import { getTimeEntriesByTask } from './db';

const mockGetTimeEntriesByTask = vi.mocked(getTimeEntriesByTask);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
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
    workTypeId: null,
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
    startUtc: '2024-06-15T08:00:00.000Z',
    endUtc: '2024-06-15T09:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'pending',
    createdAt: '2024-06-15T09:00:00.000Z',
    updatedAt: '2024-06-15T09:00:00.000Z',
    ...overrides,
  };
}

function makeTimer(overrides: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    id: 'timer-1',
    taskId: 'task-1',
    startUtc: '2024-06-15T09:00:00.000Z',
    source: 'manual',
    workers: 1,
    ...overrides,
  };
}

describe('getTaskTimeBreakdownAttribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T10:00:00.000Z'));
    mockGetTimeEntriesByTask.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('excludes measurable subtask entries from parent totals', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-parent',
    });
    const subtask = makeTask({
      id: 'child',
      parentId: 'parent',
      workQuantity: 50,
      workUnit: 'm2',
      workTypeId: 'wt-child',
    });

    mockGetTimeEntriesByTask.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent') {
        return [makeEntry({ id: 'e-parent', taskId: 'parent' })];
      }
      if (taskId === 'child') {
        return [makeEntry({ id: 'e-child', taskId: 'child' })];
      }
      return [];
    });

    const breakdown = await getTaskTimeBreakdownAttribution(
      'parent',
      ['child'],
      [parent, subtask],
      [],
    );

    expect(breakdown.totalMs).toBe(3_600_000);
    expect(breakdown.directMs).toBe(3_600_000);
    expect(breakdown.subtaskMs).toBe(0);
    expect(breakdown.entryCount).toBe(1);
    expect(breakdown.subtaskEntryCount).toBe(0);
  });

  it('includes unattributed subtask duration and timer duration for the parent', async () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-parent',
    });
    const subtask = makeTask({
      id: 'child',
      parentId: 'parent',
    });

    mockGetTimeEntriesByTask.mockImplementation(async (taskId: string) => {
      if (taskId === 'parent') return [];
      if (taskId === 'child') {
        return [
          makeEntry({
            id: 'e-child',
            taskId: 'child',
            startUtc: '2024-06-15T09:00:00.000Z',
            endUtc: '2024-06-15T09:30:00.000Z',
            workers: 1,
          }),
        ];
      }
      return [];
    });

    const timer = makeTimer({
      taskId: 'child',
      startUtc: '2024-06-15T09:30:00.000Z',
      workers: 2,
    });

    const breakdown = await getTaskTimeBreakdownAttribution(
      'parent',
      ['child'],
      [parent, subtask],
      [timer],
    );

    expect(breakdown.totalMs).toBe(3_600_000);
    expect(breakdown.directMs).toBe(0);
    expect(breakdown.subtaskMs).toBe(3_600_000);
    expect(breakdown.totalPersonMs).toBe(5_400_000);
    expect(breakdown.directPersonMs).toBe(0);
    expect(breakdown.subtaskPersonMs).toBe(5_400_000);
    expect(breakdown.hasMultipleWorkers).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkReassignToSuggested, bulkSetWorkContext } from './bulk-fix';
import type { IssueQueueItem } from './issue-queue';

vi.mock('../db', () => ({
  getTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  addTaskNote: vi.fn(),
}));

import { getTimeEntry, updateTimeEntry, getTask, updateTask, addTaskNote } from '../db';

const mockGetTimeEntry = vi.mocked(getTimeEntry);
const mockUpdateTimeEntry = vi.mocked(updateTimeEntry);
const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockAddTaskNote = vi.mocked(addTaskNote);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseEntry = {
  id: 'entry-1',
  taskId: 'task-old',
  startUtc: '2024-01-01T08:00:00.000Z',
  endUtc: '2024-01-01T09:00:00.000Z',
  source: 'manual' as const,
  workers: 1,
  syncStatus: 'pending' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const baseTask = {
  id: 'task-old',
  title: 'Old Task',
  status: 'completed' as const,
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
};

describe('bulkReassignToSuggested', () => {
  it('reassigns entries to suggested targets with audit notes', async () => {
    const items: IssueQueueItem[] = [{
      category: 'ambiguous_owner',
      taskId: 'task-old',
      entryId: 'entry-1',
      taskTitle: 'Old Task',
      description: 'test',
      suggestedTargetId: 'task-new',
      suggestedTargetTitle: 'New Task',
      personHours: 2,
    }];

    mockGetTimeEntry.mockResolvedValue(baseEntry);
    mockUpdateTimeEntry.mockResolvedValue(undefined);
    mockGetTask.mockImplementation(async (id: string) => {
      if (id === 'task-old') return { ...baseTask, id: 'task-old', title: 'Old Task' };
      if (id === 'task-new') return { ...baseTask, id: 'task-new', title: 'New Task' };
      return null;
    });
    mockAddTaskNote.mockResolvedValue(undefined);

    const result = await bulkReassignToSuggested(items, 'Bulk fix');

    expect(result.succeeded).toBe(1);
    expect(result.failed).toHaveLength(0);
    expect(mockUpdateTimeEntry).toHaveBeenCalledOnce();
    expect(mockUpdateTimeEntry.mock.calls[0][0].taskId).toBe('task-new');
    // Two audit notes: one on old task, one on new task
    expect(mockAddTaskNote).toHaveBeenCalledTimes(2);
  });

  it('skips items without suggestedTargetId', async () => {
    const items: IssueQueueItem[] = [{
      category: 'needs_measurable_owner',
      taskId: 'task-1',
      entryId: 'entry-1',
      taskTitle: 'Task',
      description: 'test',
      suggestedTargetId: null,
      suggestedTargetTitle: null,
      personHours: 2,
    }];

    const result = await bulkReassignToSuggested(items, 'test');
    expect(result.attempted).toBe(0);
  });

  it('skips items without entryId', async () => {
    const items: IssueQueueItem[] = [{
      category: 'no_work_context',
      taskId: 'task-1',
      entryId: null,
      taskTitle: 'Task',
      description: 'test',
      suggestedTargetId: 'task-2',
      suggestedTargetTitle: 'Other',
      personHours: 0,
    }];

    const result = await bulkReassignToSuggested(items, 'test');
    expect(result.attempted).toBe(0);
  });

  it('records failures for missing entries', async () => {
    const items: IssueQueueItem[] = [{
      category: 'ambiguous_owner',
      taskId: 'task-old',
      entryId: 'missing',
      taskTitle: 'Task',
      description: 'test',
      suggestedTargetId: 'task-new',
      suggestedTargetTitle: 'New',
      personHours: 1,
    }];

    mockGetTimeEntry.mockResolvedValue(null);

    const result = await bulkReassignToSuggested(items, 'test');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('not found');
  });
});

describe('bulkSetWorkContext', () => {
  it('sets work context on tasks with audit notes', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    const result = await bulkSetWorkContext(
      ['task-old'],
      { workCategory: 'carpet-tiles', workUnit: 'm2', workQuantity: 100, buildPhase: 'build-up' },
    );

    expect(result.succeeded).toBe(1);
    expect(mockUpdateTask).toHaveBeenCalledOnce();
    const updated = mockUpdateTask.mock.calls[0][0];
    expect(updated.workCategory).toBe('carpet-tiles');
    expect(updated.workUnit).toBe('m2');
    expect(updated.workQuantity).toBe(100);
    // Audit note written
    expect(mockAddTaskNote).toHaveBeenCalledOnce();
    const note = mockAddTaskNote.mock.calls[0][0];
    expect(note.text).toContain('[AUDIT]');
    expect(note.text).toContain('Bulk work context set');
  });

  it('records failures for missing tasks', async () => {
    mockGetTask.mockResolvedValue(null);

    const result = await bulkSetWorkContext(
      ['missing'],
      { workCategory: 'carpet-tiles', workUnit: 'm2', workQuantity: 100, buildPhase: null },
    );

    expect(result.failed).toHaveLength(1);
    expect(result.succeeded).toBe(0);
  });

  it('handles multiple tasks', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    const result = await bulkSetWorkContext(
      ['t1', 't2', 't3'],
      { workCategory: 'furniture', workUnit: 'pcs', workQuantity: 50, buildPhase: null },
    );

    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(mockUpdateTask).toHaveBeenCalledTimes(3);
    expect(mockAddTaskNote).toHaveBeenCalledTimes(3);
  });
});

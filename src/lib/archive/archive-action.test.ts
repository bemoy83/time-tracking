import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archiveTask, archiveAllCompleted } from './archive-action';

vi.mock('../db', () => ({
  getTask: vi.fn(),
  updateTask: vi.fn(),
  getTimeEntriesByTask: vi.fn(),
  getAllTasks: vi.fn(),
  addTaskNote: vi.fn(),
}));

import { getTask, updateTask, getTimeEntriesByTask, getAllTasks, addTaskNote } from '../db';

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockGetEntries = vi.mocked(getTimeEntriesByTask);
const mockGetAllTasks = vi.mocked(getAllTasks);
const mockAddTaskNote = vi.mocked(addTaskNote);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseTask = {
  id: 'task-1',
  title: 'Test Task',
  status: 'completed' as const,
  projectId: null,
  parentId: null,
  blockedReason: null,
  estimatedMinutes: null,
  workQuantity: 100,
  workUnit: 'm2' as const,
  defaultWorkers: null,
  targetProductivity: null,
  buildPhase: 'build-up' as const,
  workCategory: 'carpet-tiles' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  archivedAt: null,
  archiveVersion: null,
};

const validEntry = {
  id: 'entry-1',
  taskId: 'task-1',
  startUtc: '2024-01-01T08:00:00.000Z',
  endUtc: '2024-01-01T09:00:00.000Z',
  source: 'manual' as const,
  workers: 1,
  syncStatus: 'pending' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('archiveTask', () => {
  it('archives a valid completed task', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockGetAllTasks.mockResolvedValue([baseTask]);
    mockGetEntries.mockResolvedValue([validEntry]);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    const result = await archiveTask('task-1');

    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task-1');
    expect(mockUpdateTask).toHaveBeenCalledOnce();
    const updated = mockUpdateTask.mock.calls[0][0];
    expect(updated.archivedAt).toBeTruthy();
    expect(updated.archiveVersion).toBe('v1');
  });

  it('writes audit note on archive', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockGetAllTasks.mockResolvedValue([baseTask]);
    mockGetEntries.mockResolvedValue([validEntry]);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await archiveTask('task-1');

    expect(mockAddTaskNote).toHaveBeenCalledOnce();
    const note = mockAddTaskNote.mock.calls[0][0];
    expect(note.taskId).toBe('task-1');
    expect(note.text).toContain('[AUDIT]');
    expect(note.text).toContain('Task archived');
  });

  it('returns early for already archived task', async () => {
    mockGetTask.mockResolvedValue({
      ...baseTask,
      archivedAt: '2024-01-02T00:00:00.000Z',
      archiveVersion: 'v1',
    });

    const result = await archiveTask('task-1');

    expect(result.success).toBe(true);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('throws for non-existent task', async () => {
    mockGetTask.mockResolvedValue(null);
    await expect(archiveTask('missing')).rejects.toThrow('Task missing not found');
  });

  it('throws for non-completed task', async () => {
    mockGetTask.mockResolvedValue({ ...baseTask, status: 'active' });
    await expect(archiveTask('task-1')).rejects.toThrow('not completed');
  });

  it('blocks archival when integrity errors exist', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockGetAllTasks.mockResolvedValue([baseTask]);
    // zero-duration entry → integrity error
    mockGetEntries.mockResolvedValue([{
      ...validEntry,
      endUtc: validEntry.startUtc,
    }]);

    const result = await archiveTask('task-1');

    expect(result.success).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('allows archival with warnings only', async () => {
    const taskMissingCategory = { ...baseTask, workCategory: null };
    mockGetTask.mockResolvedValue(taskMissingCategory);
    mockGetAllTasks.mockResolvedValue([taskMissingCategory]);
    mockGetEntries.mockResolvedValue([]);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    const result = await archiveTask('task-1');

    expect(result.success).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].severity).toBe('warning');
  });
});

describe('archiveAllCompleted', () => {
  it('archives all eligible completed tasks', async () => {
    const task2 = { ...baseTask, id: 'task-2' };
    mockGetAllTasks.mockResolvedValue([baseTask, task2]);
    mockGetTask.mockImplementation(async (id: string) => {
      if (id === 'task-1') return baseTask;
      if (id === 'task-2') return task2;
      return null;
    });
    mockGetEntries.mockResolvedValue([validEntry]);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    const results = await archiveAllCompleted();

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('skips already-archived and non-completed tasks', async () => {
    const archived = { ...baseTask, id: 'a', archivedAt: '2024-01-02T00:00:00.000Z', archiveVersion: 'v1' };
    const active = { ...baseTask, id: 'b', status: 'active' as const };
    mockGetAllTasks.mockResolvedValue([archived, active]);

    const results = await archiveAllCompleted();

    expect(results).toHaveLength(0);
  });
});

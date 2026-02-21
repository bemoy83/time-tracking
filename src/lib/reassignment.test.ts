/**
 * Tests for reassignTimeEntry — verifies taskId mutation,
 * audit note creation on both old and new tasks, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reassignTimeEntry } from './reassignment';

// --- mock DB layer ---
vi.mock('./db', () => ({
  getTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  getTask: vi.fn(),
  addTaskNote: vi.fn(),
}));

import { getTimeEntry, updateTimeEntry, getTask, addTaskNote } from './db';

const mockGetTimeEntry = vi.mocked(getTimeEntry);
const mockUpdateTimeEntry = vi.mocked(updateTimeEntry);
const mockGetTask = vi.mocked(getTask);
const mockAddTaskNote = vi.mocked(addTaskNote);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reassignTimeEntry', () => {
  const baseEntry = {
    id: 'entry-1',
    taskId: 'old-task',
    startUtc: '2024-01-01T08:00:00.000Z',
    endUtc: '2024-01-01T09:00:00.000Z',
    source: 'manual' as const,
    workers: 1,
    syncStatus: 'pending' as const,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('updates entry taskId to new task', async () => {
    mockGetTimeEntry.mockResolvedValue(baseEntry);
    mockGetTask.mockResolvedValue(null);
    mockUpdateTimeEntry.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await reassignTimeEntry('entry-1', 'new-task', 'Wrong task');

    expect(mockUpdateTimeEntry).toHaveBeenCalledOnce();
    const updated = mockUpdateTimeEntry.mock.calls[0][0];
    expect(updated.taskId).toBe('new-task');
    expect(updated.id).toBe('entry-1');
  });

  it('creates audit notes on both old and new tasks', async () => {
    mockGetTimeEntry.mockResolvedValue(baseEntry);
    mockGetTask.mockImplementation(async (id: string) => {
      if (id === 'old-task') return { id: 'old-task', title: 'Old Task' } as any;
      if (id === 'new-task') return { id: 'new-task', title: 'New Task' } as any;
      return null;
    });
    mockUpdateTimeEntry.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await reassignTimeEntry('entry-1', 'new-task', 'Wrong assignment');

    expect(mockAddTaskNote).toHaveBeenCalledTimes(2);

    const notes = mockAddTaskNote.mock.calls.map((c) => c[0]);
    const oldNote = notes.find((n: any) => n.taskId === 'old-task');
    const newNote = notes.find((n: any) => n.taskId === 'new-task');

    expect(oldNote).toBeDefined();
    expect(oldNote!.text).toContain('[AUDIT]');
    expect(oldNote!.text).toContain('reassigned away');
    expect(oldNote!.text).toContain('New Task');
    expect(oldNote!.text).toContain('Wrong assignment');

    expect(newNote).toBeDefined();
    expect(newNote!.text).toContain('[AUDIT]');
    expect(newNote!.text).toContain('reassigned here');
    expect(newNote!.text).toContain('Old Task');
    expect(newNote!.text).toContain('Wrong assignment');
  });

  it('throws when entry not found', async () => {
    mockGetTimeEntry.mockResolvedValue(null);

    await expect(reassignTimeEntry('missing', 'new-task', 'reason'))
      .rejects.toThrow('Time entry missing not found');
  });

  it('no-ops when old and new task are the same', async () => {
    mockGetTimeEntry.mockResolvedValue(baseEntry);

    await reassignTimeEntry('entry-1', 'old-task', 'reason');

    expect(mockUpdateTimeEntry).not.toHaveBeenCalled();
    expect(mockAddTaskNote).not.toHaveBeenCalled();
  });

  it('uses taskId as fallback title when task not found', async () => {
    mockGetTimeEntry.mockResolvedValue(baseEntry);
    mockGetTask.mockResolvedValue(null); // both tasks not found
    mockUpdateTimeEntry.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await reassignTimeEntry('entry-1', 'new-task', 'reason');

    const notes = mockAddTaskNote.mock.calls.map((c) => c[0]);
    const oldNote = notes.find((n: any) => n.taskId === 'old-task');
    const newNote = notes.find((n: any) => n.taskId === 'new-task');

    // Should use taskId as fallback title
    expect(oldNote!.text).toContain('new-task');
    expect(newNote!.text).toContain('old-task');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveRecommendationToTask } from './calculator-save';

vi.mock('./db', () => ({
  getTask: vi.fn(),
  updateTask: vi.fn(),
  addTaskNote: vi.fn(),
}));

import { getTask, updateTask, addTaskNote } from './db';

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockAddTaskNote = vi.mocked(addTaskNote);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseTask = {
  id: 'task-1',
  title: 'Test Task',
  status: 'active' as const,
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

describe('saveRecommendationToTask', () => {
  it('saves crew recommendation to task.defaultWorkers', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await saveRecommendationToTask({
      taskId: 'task-1',
      type: 'crew',
      crewValue: 4,
      rateUsed: 10,
      rateSource: 'historical',
      workUnit: 'm2',
      quantityUsed: 100,
      sampleCount: 5,
    });

    expect(mockUpdateTask).toHaveBeenCalledOnce();
    const updated = mockUpdateTask.mock.calls[0][0];
    expect(updated.defaultWorkers).toBe(4);
  });

  it('saves time recommendation to task.estimatedMinutes', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await saveRecommendationToTask({
      taskId: 'task-1',
      type: 'time',
      estimatedMinutes: 120,
      rateUsed: 10,
      rateSource: 'template',
      workUnit: 'm2',
      quantityUsed: 100,
      sampleCount: null,
    });

    const updated = mockUpdateTask.mock.calls[0][0];
    expect(updated.estimatedMinutes).toBe(120);
  });

  it('writes audit note with provenance', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await saveRecommendationToTask({
      taskId: 'task-1',
      type: 'crew',
      crewValue: 3,
      rateUsed: 10,
      rateSource: 'historical',
      workUnit: 'm2',
      quantityUsed: 200,
      sampleCount: 8,
    });

    expect(mockAddTaskNote).toHaveBeenCalledOnce();
    const note = mockAddTaskNote.mock.calls[0][0];
    expect(note.taskId).toBe('task-1');
    expect(note.text).toContain('[AUDIT]');
    expect(note.text).toContain('Calculator recommendation applied');
    expect(note.text).toContain('3 workers');
    expect(note.text).toContain('historical avg');
    expect(note.text).toContain('8 tasks');
  });

  it('throws when task not found', async () => {
    mockGetTask.mockResolvedValue(null);

    await expect(saveRecommendationToTask({
      taskId: 'missing',
      type: 'crew',
      crewValue: 2,
      rateUsed: 10,
      rateSource: 'template',
      workUnit: 'm2',
      quantityUsed: 100,
      sampleCount: null,
    })).rejects.toThrow('Task missing not found');
  });
});

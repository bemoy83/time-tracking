import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveRecommendationToTask, saveRecommendationToTemplate } from './calculator-save';

vi.mock('./db', () => ({
  getTask: vi.fn(),
  updateTask: vi.fn(),
  addTaskNote: vi.fn(),
  getTaskTemplate: vi.fn(),
  updateTaskTemplate: vi.fn(),
  addTemplateNote: vi.fn(),
}));

import { getTask, updateTask, addTaskNote, getTaskTemplate, updateTaskTemplate, addTemplateNote } from './db';

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockAddTaskNote = vi.mocked(addTaskNote);
const mockGetTaskTemplate = vi.mocked(getTaskTemplate);
const mockUpdateTaskTemplate = vi.mocked(updateTaskTemplate);
const mockAddTemplateNote = vi.mocked(addTemplateNote);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseTask = {
  id: 'task-1',
  title: 'Test Task',
  status: 'active' as const,
  projectId: null,
  parentId: null,
  blockReason: null,
  estimatedMinutes: null,
  workQuantity: 100,
  workUnit: 'm2' as const,
  crew: null,
  targetProductivity: null,
  buildPhase: 'build-up' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  archivedAt: null,
  archiveVersion: null,
  workTypeId: null,
};

const baseTemplate = {
  id: 'tmpl-1',
  title: 'Template',
  workTypeId: 'wt-1',
  workUnit: 'm2' as const,
  workQuantity: 100,
  estimatedMinutes: null,
  crew: null,
  targetProductivity: 10,
  buildPhase: 'build-up' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('saveRecommendationToTask', () => {
  it('saves crew recommendation to task.crew', async () => {
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
    expect(updated.crew).toBe(4);
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

  it('supports manual rate provenance in audit note', async () => {
    mockGetTask.mockResolvedValue(baseTask);
    mockUpdateTask.mockResolvedValue(undefined);
    mockAddTaskNote.mockResolvedValue(undefined);

    await saveRecommendationToTask({
      taskId: 'task-1',
      type: 'time',
      estimatedMinutes: 95,
      rateUsed: 7.5,
      rateSource: 'manual',
      workUnit: 'm2',
      quantityUsed: 80,
      sampleCount: null,
    });

    const note = mockAddTaskNote.mock.calls[0][0];
    expect(note.text).toContain('manual rate');
  });
});

describe('saveRecommendationToTemplate', () => {
  it('saves crew recommendation to template.crew', async () => {
    mockGetTaskTemplate.mockResolvedValue(baseTemplate);
    mockUpdateTaskTemplate.mockResolvedValue(undefined);
    mockAddTemplateNote.mockResolvedValue(undefined);

    await saveRecommendationToTemplate({
      templateId: 'tmpl-1',
      type: 'crew',
      crewValue: 5,
      rateUsed: 12,
      rateSource: 'historical',
      workUnit: 'm2',
      quantityUsed: 120,
      sampleCount: 9,
    });

    expect(mockUpdateTaskTemplate).toHaveBeenCalledOnce();
    const updated = mockUpdateTaskTemplate.mock.calls[0][0];
    expect(updated.crew).toBe(5);
    expect(mockAddTemplateNote).toHaveBeenCalledOnce();
    expect(mockAddTemplateNote.mock.calls[0][0].templateId).toBe('tmpl-1');
  });

  it('throws when template not found', async () => {
    mockGetTaskTemplate.mockResolvedValue(null);

    await expect(saveRecommendationToTemplate({
      templateId: 'missing',
      type: 'time',
      estimatedMinutes: 120,
      rateUsed: 10,
      rateSource: 'template',
      workUnit: 'm2',
      quantityUsed: 100,
      sampleCount: null,
    })).rejects.toThrow('Template missing not found');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  addTaskNote: vi.fn(),
  findWorkTypeByKey: vi.fn(),
  getTask: vi.fn(),
  getTimeEntry: vi.fn(),
  getWorkType: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../stores/task-store', () => ({
  getTaskById: vi.fn(),
  updateTaskFields: vi.fn(),
}));

vi.mock('../stores/work-type-store', () => ({
  createWorkType: vi.fn(),
  findWorkTypeByKey: vi.fn(),
}));

import {
  addTaskNote,
  findWorkTypeByKey as findWorkTypeByKeyInDb,
  getTask,
  getTimeEntry,
  getWorkType,
  updateTask,
} from '../db';
import { getTaskById, updateTaskFields } from '../stores/task-store';
import { createWorkType, findWorkTypeByKey as findWorkTypeByKeyInStore } from '../stores/work-type-store';
import {
  bulkClassifyToRecommendedWorkType,
  classifyEntryToWorkType,
  createAndClassifyFromEntry,
  WorkTypeConflictError,
} from './worktype-classify';

const mockAddTaskNote = vi.mocked(addTaskNote);
const mockFindWorkTypeByKey = vi.mocked(findWorkTypeByKeyInDb);
const mockGetTask = vi.mocked(getTask);
const mockGetTimeEntry = vi.mocked(getTimeEntry);
const mockGetWorkType = vi.mocked(getWorkType);
const mockUpdateTask = vi.mocked(updateTask);
const mockGetTaskById = vi.mocked(getTaskById);
const mockUpdateTaskFields = vi.mocked(updateTaskFields);
const mockCreateWorkType = vi.mocked(createWorkType);
const mockStoreFindWorkTypeByKey = vi.mocked(findWorkTypeByKeyInStore);

const baseTask = {
  id: 'task-1',
  title: 'Install carpet',
  status: 'completed' as const,
  projectId: null,
  parentId: null,
  blockedReason: null,
  estimatedMinutes: null,
  workQuantity: 120,
  workUnit: null,
  defaultWorkers: null,
  targetProductivity: null,
  buildPhase: null,
  workTypeId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  archivedAt: null,
  archiveVersion: null,
};

const baseEntry = {
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

const baseWorkType = {
  id: 'wt-1',
  title: 'Carpet Tiles',
  workUnit: 'm2' as const,
  buildPhase: 'build-up' as const,
  expectedProductivity: 55,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTimeEntry.mockResolvedValue(baseEntry);
  mockGetTask.mockResolvedValue(baseTask);
  mockGetWorkType.mockResolvedValue(baseWorkType);
  mockGetTaskById.mockReturnValue(baseTask);
  mockUpdateTaskFields.mockResolvedValue(undefined);
  mockUpdateTask.mockResolvedValue(undefined);
  mockAddTaskNote.mockResolvedValue(undefined);
  mockFindWorkTypeByKey.mockResolvedValue(null);
  mockStoreFindWorkTypeByKey.mockReturnValue(undefined);
  mockCreateWorkType.mockResolvedValue(baseWorkType);
});

describe('classifyEntryToWorkType', () => {
  it('updates the source task with WorkType fields and writes audit note', async () => {
    const result = await classifyEntryToWorkType('entry-1', 'wt-1', 'Resolve unattributed work');

    expect(mockUpdateTaskFields).toHaveBeenCalledTimes(1);
    expect(mockUpdateTaskFields).toHaveBeenCalledWith('task-1', {
      workTypeId: 'wt-1',
      workUnit: 'm2',
      buildPhase: 'build-up',
      targetProductivity: 55,
    });
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockAddTaskNote).toHaveBeenCalledTimes(1);
    expect(mockAddTaskNote.mock.calls[0][0].text).toContain('[AUDIT]');
    expect(result.warning).toBeNull();
  });

  it('blocks assignment when task unit conflicts with WorkType unit', async () => {
    mockGetTask.mockResolvedValue({ ...baseTask, workUnit: 'm' });

    await expect(
      classifyEntryToWorkType('entry-1', 'wt-1', 'test'),
    ).rejects.toThrow('Unit mismatch');
    expect(mockUpdateTaskFields).not.toHaveBeenCalled();
    expect(mockAddTaskNote).not.toHaveBeenCalled();
  });

  it('blocks assignment when task phase conflicts with WorkType phase', async () => {
    mockGetTask.mockResolvedValue({ ...baseTask, buildPhase: 'tear-down' });

    await expect(
      classifyEntryToWorkType('entry-1', 'wt-1', 'test'),
    ).rejects.toThrow('Build phase mismatch');
    expect(mockUpdateTaskFields).not.toHaveBeenCalled();
    expect(mockAddTaskNote).not.toHaveBeenCalled();
  });

  it('saves WorkType assignment when quantity is missing and returns warning', async () => {
    mockGetTask.mockResolvedValue({
      ...baseTask,
      workQuantity: null,
      workUnit: 'm2',
      buildPhase: 'build-up',
    });
    mockGetTaskById.mockReturnValue(undefined);

    const result = await classifyEntryToWorkType('entry-1', 'wt-1', 'Fix owner');

    expect(result.warning).toBe('missing_quantity');
    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    const updated = mockUpdateTask.mock.calls[0][0];
    expect(updated.workTypeId).toBe('wt-1');
    expect(updated.workUnit).toBe('m2');
    expect(updated.buildPhase).toBe('build-up');
  });

  it('classifies parent scope when source entry task lacks quantity context', async () => {
    mockGetTimeEntry.mockResolvedValue({ ...baseEntry, taskId: 'task-child' });
    const parentTask = {
      ...baseTask,
      id: 'task-parent',
      title: 'Parent Scope',
      workQuantity: 80,
      workUnit: 'm2' as const,
      buildPhase: 'build-up' as const,
    };
    const childTask = {
      ...baseTask,
      id: 'task-child',
      title: 'Child Task',
      parentId: 'task-parent',
      workQuantity: null,
      workUnit: null,
      buildPhase: null,
    };
    mockGetTask.mockImplementation(async (id: string) => {
      if (id === 'task-child') return childTask;
      if (id === 'task-parent') return parentTask;
      return null;
    });
    mockGetTaskById.mockImplementation((id: string) => {
      if (id === 'task-parent') return parentTask;
      if (id === 'task-child') return childTask;
      return undefined;
    });

    const result = await classifyEntryToWorkType('entry-1', 'wt-1', 'Scope classify');

    expect(mockUpdateTaskFields).toHaveBeenCalledWith('task-parent', {
      workTypeId: 'wt-1',
      workUnit: 'm2',
      buildPhase: 'build-up',
      targetProductivity: 55,
    });
    expect(result.sourceTaskId).toBe('task-child');
    expect(result.taskId).toBe('task-parent');
  });
});

describe('createAndClassifyFromEntry', () => {
  it('throws conflict error when WorkType key already exists', async () => {
    mockFindWorkTypeByKey.mockResolvedValue({
      ...baseWorkType,
      id: 'existing-wt',
      title: 'Existing Carpet',
    });
    mockStoreFindWorkTypeByKey.mockReturnValue(undefined);

    await expect(
      createAndClassifyFromEntry('entry-1', { title: 'Existing Carpet' }, 'Create from remediation'),
    ).rejects.toBeInstanceOf(WorkTypeConflictError);
    expect(mockCreateWorkType).not.toHaveBeenCalled();
  });

  it('creates WorkType from task defaults and classifies source task', async () => {
    const created = {
      ...baseWorkType,
      id: 'wt-new',
      title: 'Install carpet',
      expectedProductivity: 10,
    };
    mockCreateWorkType.mockResolvedValue(created);
    mockGetWorkType.mockResolvedValue(created);
    mockGetTask.mockResolvedValue({ ...baseTask, targetProductivity: null });

    const result = await createAndClassifyFromEntry('entry-1', {}, 'New pattern');

    expect(mockCreateWorkType).toHaveBeenCalledWith({
      title: 'Install carpet',
      workUnit: 'm2',
      buildPhase: 'build-up',
      expectedProductivity: 10,
    });
    expect(result.createdWorkTypeId).toBe('wt-new');
    expect(mockUpdateTaskFields).toHaveBeenCalled();
  });
});

describe('bulkClassifyToRecommendedWorkType', () => {
  it('fails grouped scope when recommendations conflict', async () => {
    const result = await bulkClassifyToRecommendedWorkType([
      {
        category: 'ambiguous_owner',
        taskId: 'scope-1',
        scopeTaskId: 'scope-1',
        entryId: null,
        entryIds: ['e1', 'e2'],
        entryCount: 2,
        taskTitle: 'Scope',
        description: 'conflict',
        suggestedTargetId: null,
        suggestedTargetTitle: null,
        recommendedWorkTypeId: null,
        conflictingRecommendedWorkTypeIds: ['wt-1', 'wt-2'],
        suggestionSource: null,
        personHours: 2,
      },
    ], 'bulk');

    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].itemId).toBe('scope-1');
    expect(result.failed[0].error).toContain('Conflicting WorkType recommendations');
    expect(mockUpdateTaskFields).not.toHaveBeenCalled();
  });
});

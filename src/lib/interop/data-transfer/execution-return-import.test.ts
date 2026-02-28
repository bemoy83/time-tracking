import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyExecutionReturnImport,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from './execution-return-import';
import type { DataTransferEnvelope, ExecutionReturnPayload } from './contracts';
import {
  addExecutionReturnLineItems,
  addExecutionReturnRecord,
  addExecutionReturnUnplannedTasks,
  addTask,
  addTimeEntry,
  getAllTimeEntries,
  getTask,
  updateTask,
} from '../../db';

vi.mock('../../db', () => ({
  addExecutionReturnLineItems: vi.fn(),
  addExecutionReturnRecord: vi.fn(),
  addExecutionReturnUnplannedTasks: vi.fn(),
  addTask: vi.fn(),
  addTimeEntry: vi.fn(),
  getAllTimeEntries: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../../stores/task-store', () => ({
  refreshTasks: vi.fn(),
}));

const mockGetAllTimeEntries = vi.mocked(getAllTimeEntries);
const mockAddTimeEntry = vi.mocked(addTimeEntry);
const mockAddTask = vi.mocked(addTask);
const mockGetTask = vi.mocked(getTask);
const mockAddExecutionReturnRecord = vi.mocked(addExecutionReturnRecord);
const mockAddExecutionReturnLineItems = vi.mocked(addExecutionReturnLineItems);
const mockAddExecutionReturnUnplannedTasks = vi.mocked(addExecutionReturnUnplannedTasks);

function makePlanTask(
  overrides: Partial<{ id: string; status: string; sourceLineItemId: string | null }> = {},
) {
  return {
    id: 'task-1',
    title: 'Install carpet',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 120,
    workUnit: 'm2',
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: 'build-up',
    workTypeId: null,
    createdAt: '2026-02-27T08:00:00.000Z',
    updatedAt: '2026-02-27T09:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: 'li-1',
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeEnvelope(): DataTransferEnvelope<ExecutionReturnPayload> {
  return {
    schemaVersion: '1.0',
    exportType: 'execution-return',
    exportedAt: '2026-02-27T00:00:00.000Z',
    appVersion: '0.0.1',
    payload: {
      planId: 'plan-1',
      planTitle: 'Build-up Plan',
      closedAt: '2026-02-27T10:00:00.000Z',
      summary: {
        completed: 1,
        blocked: 0,
        deferred: 0,
        pending: 0,
        inProgress: 0,
        unplannedTaskCount: 1,
        totalPersonHours: 4,
      },
      lineItems: [
        {
          lineItemId: 'li-1',
          title: 'Install carpet',
          executionStatus: 'completed',
          blockReason: null,
          blockCategory: null,
          executorNote: 'Finished early',
          deferredNote: null,
          removedFromSource: false,
          scheduledStart: '2026-02-27',
          scheduledEnd: '2026-02-27',
          actualStartDate: '2026-02-27',
          actualEndDate: '2026-02-27',
          deadlineStatusAtClose: 'done-on-time',
        },
      ],
      tasks: [makePlanTask({ id: 'task-1', status: 'active', sourceLineItemId: 'li-1' })],
      unplannedTasks: [
        {
          id: 'task-u-1',
          title: 'Cleanup aisle',
          status: 'completed',
          projectId: 'project-1',
          parentId: null,
          blockedReason: null,
          estimatedMinutes: null,
          workQuantity: null,
          workUnit: null,
          defaultWorkers: null,
          targetProductivity: null,
          buildPhase: null,
          workTypeId: null,
          createdAt: '2026-02-27T08:00:00.000Z',
          updatedAt: '2026-02-27T09:00:00.000Z',
          archivedAt: null,
          archiveVersion: null,
          sourcePlanId: null,
          sourceLineItemId: null,
          excludeFromKpi: false,
        },
      ],
      workTypes: [],
      timeEntries: [
        {
          id: 'te-1',
          taskId: 'task-1',
          startUtc: '2026-02-27T08:00:00.000Z',
          endUtc: '2026-02-27T09:00:00.000Z',
          source: 'manual',
          workers: 2,
          syncStatus: 'synced',
          createdAt: '2026-02-27T09:00:00.000Z',
          updatedAt: '2026-02-27T09:00:00.000Z',
        },
        {
          id: 'te-2',
          taskId: 'task-u-1',
          startUtc: '2026-02-27T09:00:00.000Z',
          endUtc: '2026-02-27T10:00:00.000Z',
          source: 'manual',
          workers: 1,
          syncStatus: 'synced',
          createdAt: '2026-02-27T10:00:00.000Z',
          updatedAt: '2026-02-27T10:00:00.000Z',
        },
      ],
    },
  };
}

describe('execution-return import', () => {
  beforeEach(() => {
    mockGetAllTimeEntries.mockReset();
    mockAddTimeEntry.mockReset();
    mockAddTask.mockReset();
    mockGetTask.mockResolvedValue(null); // tasks don't exist yet
    mockAddExecutionReturnRecord.mockReset();
    mockAddExecutionReturnLineItems.mockReset();
    mockAddExecutionReturnUnplannedTasks.mockReset();
  });

  it('rejects non-execution-return exports', () => {
    const text = JSON.stringify({
      schemaVersion: '1.0',
      exportType: 'plan-package',
      payload: {},
    });

    const parsed = parseExecutionReturnJson(text);

    expect(parsed.ok).toBe(false);
  });

  it('previews duplicates and date range', async () => {
    const envelope = makeEnvelope();
    mockGetAllTimeEntries.mockResolvedValue([
      {
        ...envelope.payload.timeEntries[0],
      },
    ]);

    const preview = await previewExecutionReturnImport(envelope);

    expect(preview.timeEntryCount).toBe(2);
    expect(preview.duplicateTimeEntryIds).toEqual(['te-1']);
    expect(preview.conflicts).toEqual(['duplicate-time-entry-id']);
    expect(preview.dateRangeStart).toBe('2026-02-27T08:00:00.000Z');
    expect(preview.dateRangeEnd).toBe('2026-02-27T10:00:00.000Z');
  });

  it('imports non-duplicate entries and persists execution-return snapshots', async () => {
    const envelope = makeEnvelope();
    mockGetAllTimeEntries.mockResolvedValue([
      {
        ...envelope.payload.timeEntries[0],
      },
    ]);

    const preview = await previewExecutionReturnImport(envelope);
    const result = await applyExecutionReturnImport(preview);

    expect(result.importedEntryCount).toBe(1);
    expect(result.skippedDuplicateEntryCount).toBe(1);
    expect(mockAddTimeEntry).toHaveBeenCalledTimes(1);
    expect(mockAddExecutionReturnRecord).toHaveBeenCalledTimes(1);
    expect(mockAddExecutionReturnLineItems).toHaveBeenCalledTimes(1);
    expect(mockAddExecutionReturnUnplannedTasks).toHaveBeenCalledTimes(1);
    // Tasks from payload are upserted so Planning Progress view can show execution state
    expect(mockAddTask).toHaveBeenCalledTimes(2); // 1 plan task + 1 unplanned task
    // Plan task status synced from payload line item (executionStatus: 'completed')
    expect(mockAddTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'completed',
        sourceLineItemId: 'li-1',
      }),
    );
    expect(mockAddTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-u-1',
        title: 'Cleanup aisle',
        status: 'completed',
      }),
    );
  });
});

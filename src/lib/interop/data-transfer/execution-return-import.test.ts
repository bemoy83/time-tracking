import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyExecutionReturnImport,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from './execution-return-import';
import type { DataTransferEnvelope, ExecutionReturnPayload } from './contracts';
import type { Task } from '../../types';
import { createLineItem, createPlan } from '../../planning/plan-model';
import {
  addExecutionReturnLineItems,
  addExecutionReturnRecord,
  addExecutionReturnUnplannedTasks,
  addTask,
  addTimeEntry,
  getAllTimeEntries,
  getPlan,
  getTask,
  updatePlan,
} from '../../db';
import { resolveImportedWorkTypeIds } from './import-support';

vi.mock('../../db', () => ({
  addExecutionReturnLineItems: vi.fn(),
  addExecutionReturnRecord: vi.fn(),
  addExecutionReturnUnplannedTasks: vi.fn(),
  addTask: vi.fn(),
  addTimeEntry: vi.fn(),
  getAllTimeEntries: vi.fn(),
  getPlan: vi.fn(),
  getTask: vi.fn(),
  updatePlan: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../../stores/task-store', () => ({
  refreshTasks: vi.fn(),
}));

vi.mock('./import-support', () => ({
  resolveImportedWorkTypeIds: vi.fn(),
}));

const mockGetAllTimeEntries = vi.mocked(getAllTimeEntries);
const mockAddTimeEntry = vi.mocked(addTimeEntry);
const mockAddTask = vi.mocked(addTask);
const mockGetPlan = vi.mocked(getPlan);
const mockGetTask = vi.mocked(getTask);
const mockUpdatePlan = vi.mocked(updatePlan);
const mockAddExecutionReturnRecord = vi.mocked(addExecutionReturnRecord);
const mockAddExecutionReturnLineItems = vi.mocked(addExecutionReturnLineItems);
const mockAddExecutionReturnUnplannedTasks = vi.mocked(addExecutionReturnUnplannedTasks);
const mockResolveImportedWorkTypeIds = vi.mocked(resolveImportedWorkTypeIds);

function makePlanTask(
  overrides: Partial<Pick<Task, 'id' | 'status' | 'sourceLineItemId'>> = {},
): Task {
  return {
    id: 'task-1',
    title: 'Install carpet',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 120,
    workUnit: 'm2',
    crew: null,
    targetProductivity: null,
    phase: 'assembly',
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
    schemaVersion: '4.0',
    exportType: 'execution-return',
    exportedAt: '2026-02-27T00:00:00.000Z',
    appVersion: '0.0.1',
    payload: {
      planId: 'plan-1',
      planTitle: 'Assembly Plan',
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
          phase: 'assembly',
          sourceWorkPackageId: 'li-1',
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
          blockReason: null,
          estimatedMinutes: null,
          workQuantity: null,
          workUnit: null,
          crew: null,
          targetProductivity: null,
          phase: null,
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
    mockGetPlan.mockResolvedValue(null);
    mockGetTask.mockResolvedValue(null); // tasks don't exist yet
    mockUpdatePlan.mockReset();
    mockAddExecutionReturnRecord.mockReset();
    mockAddExecutionReturnLineItems.mockReset();
    mockAddExecutionReturnUnplannedTasks.mockReset();
    mockResolveImportedWorkTypeIds.mockReset();
    mockResolveImportedWorkTypeIds.mockResolvedValue(new Map());
  });

  it('rejects non-execution-return exports', () => {
    const text = JSON.stringify({
      schemaVersion: '4.0',
      exportType: 'plan-package',
      payload: {},
    });

    const parsed = parseExecutionReturnJson(text);

    expect(parsed.ok).toBe(false);
  });

  it('rejects legacy execution-return line items without canonical phase fields', () => {
    const envelope = makeEnvelope();
    const parsed = parseExecutionReturnJson(JSON.stringify({
      ...envelope,
      payload: {
        ...envelope.payload,
        lineItems: [
          {
            lineItemId: 'li-1',
            title: 'Install carpet',
            executionStatus: 'completed',
            blockReason: null,
            blockCategory: null,
            executorNote: null,
            deferredNote: null,
            removedFromSource: false,
            scheduledStart: null,
            scheduledEnd: null,
            actualStartDate: null,
            actualEndDate: null,
            deadlineStatusAtClose: null,
          },
        ],
      },
    }));

    expect(parsed).toEqual({
      ok: false,
      error: 'Selected file is not a valid execution return export.',
    });
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
    expect(result.mergeSummary).toEqual({
      importedAt: expect.any(String),
      importedEntryCount: 1,
      skippedDuplicateEntryCount: 1,
      mergedTaskCount: 2,
      lineItemCount: 1,
    });
    expect(result.reason).toBe(
      'Imported execution return. 1 new entry, 1 duplicate entry skipped, 2 tasks merged, 1 line item reflected.',
    );
    expect(mockAddTimeEntry).toHaveBeenCalledTimes(1);
    expect(mockAddExecutionReturnRecord).toHaveBeenCalledTimes(1);
    expect(mockAddExecutionReturnRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        mergeSummary: expect.objectContaining({
          importedEntryCount: 1,
          skippedDuplicateEntryCount: 1,
          mergedTaskCount: 2,
          lineItemCount: 1,
        }),
      }),
    );
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

  it('normalizes legacy blockedReason/defaultWorkers task fields from payload', async () => {
    const envelope = makeEnvelope();
    envelope.payload.lineItems[0].executionStatus = 'pending';
    envelope.payload.tasks = [
      {
        ...makePlanTask({ id: 'task-legacy', sourceLineItemId: 'li-1' }),
        crew: undefined as unknown as number | null,
        blockReason: undefined as unknown as string | null,
        defaultWorkers: 4,
        blockedReason: 'Legacy blocker',
      } as unknown as Task,
    ];
    mockGetAllTimeEntries.mockResolvedValue([]);

    const preview = await previewExecutionReturnImport(envelope);
    await applyExecutionReturnImport(preview);

    expect(mockAddTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-legacy',
        crew: 4,
        blockReason: 'Legacy blocker',
      }),
    );
  });

  it('uses import-support for work type remapping instead of plan-package internals', async () => {
    const envelope = makeEnvelope();
    envelope.payload.workTypes = [
      {
        id: 'wt-imported',
        title: 'Flooring',
        workUnit: 'm2',
        assemblyRate: 10,
        dismantleRate: 0,
        createdAt: '2026-02-27T08:00:00.000Z',
        updatedAt: '2026-02-27T08:00:00.000Z',
      },
    ];
    mockGetAllTimeEntries.mockResolvedValue([]);
    mockResolveImportedWorkTypeIds.mockResolvedValue(new Map([['wt-imported', 'wt-local']]));

    const preview = await previewExecutionReturnImport(envelope);
    await applyExecutionReturnImport(preview);

    expect(mockResolveImportedWorkTypeIds).toHaveBeenCalledWith(
      'plan-1',
      envelope.payload.workTypes,
    );
  });

  it('applies phase execution state to canonical line-item lineage', async () => {
    const envelope = makeEnvelope();
    envelope.payload.lineItems = [
      {
        lineItemId: 'wp-1',
        sourceWorkPackageId: 'wp-1',
        phase: 'dismantle',
        title: 'Install carpet',
        executionStatus: 'completed',
        blockReason: null,
        blockCategory: null,
        executorNote: null,
        deferredNote: null,
        removedFromSource: false,
        scheduledStart: '2026-02-27',
        scheduledEnd: '2026-02-27',
        actualStartDate: '2026-02-27',
        actualEndDate: '2026-02-27',
        deadlineStatusAtClose: 'done-on-time',
      },
    ];
    envelope.payload.tasks = [
      makePlanTask({
        id: 'task-td-1',
        status: 'active',
        sourceLineItemId: 'wp-1',
      }),
    ].map((task) => ({ ...task, phase: 'dismantle' as const }));
    envelope.payload.unplannedTasks = [];
    envelope.payload.timeEntries = [];

    const plan = {
      ...createPlan('Planner Plan'),
      id: 'plan-1',
      lineItems: [
        {
          ...createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 5),
          id: 'wp-1',
        },
      ],
      status: 'active' as const,
    };
    mockGetPlan.mockResolvedValue(plan);
    mockGetAllTimeEntries.mockResolvedValue([]);

    const preview = await previewExecutionReturnImport(envelope);
    await applyExecutionReturnImport(preview);

    expect(mockAddTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-td-1',
        sourceLineItemId: 'wp-1',
        phase: 'dismantle',
        status: 'completed',
      }),
    );
    expect(mockUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'plan-1',
        lineItems: [
          expect.objectContaining({
            id: 'wp-1',
            assemblyExecutionStatus: 'pending',
            dismantleExecutionStatus: 'completed',
          }),
        ],
      }),
    );
  });
});

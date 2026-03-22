import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FULL_BACKUP_STORE_MANIFEST,
  applyFullBackupImport,
  buildFullBackupEnvelope,
  exportFullBackupToFile,
  parseFullBackupJson,
  previewFullBackupImport,
} from './full-backup';
import type { DataTransferEnvelope, FullBackupPayload } from './contracts';
import { FULL_BACKUP_SNAPSHOT_FORMAT_VERSION } from './contracts';
import {
  DB_VERSION,
  getAllActiveTimers,
  getAllAttributionSnapshots,
  getAllExecutionReturnLineItems,
  getAllExecutionReturnUnplannedTasks,
  getAllExecutionReturns,
  getAllPlans,
  getAllProjects,
  getAllTags,
  getAllTagCategories,
  getAllTaskNotes,
  getAllTasks,
  getAllTaskTemplates,
  getAllTemplateNotes,
  getAllTimeEntries,
  getAllWorkTypes,
  getAllWorkUnitDefinitions,
  getCrewPool,
  getDB,
  getGlobalTagSequence,
} from '../../db';
import { downloadJson } from '../download-json';
import { invalidateAttributionCache } from '../../attribution/cache';
import { getPendingCount } from '../../sync/sync-queue';
import { nowUtc } from '../../types';

vi.mock('../../db', () => ({
  DB_VERSION: 38,
  getAllActiveTimers: vi.fn(),
  getAllAttributionSnapshots: vi.fn(),
  getAllExecutionReturnLineItems: vi.fn(),
  getAllExecutionReturnUnplannedTasks: vi.fn(),
  getAllExecutionReturns: vi.fn(),
  getAllPlans: vi.fn(),
  getAllProjects: vi.fn(),
  getAllTags: vi.fn(),
  getAllTagCategories: vi.fn(),
  getAllTaskNotes: vi.fn(),
  getAllTasks: vi.fn(),
  getAllTaskTemplates: vi.fn(),
  getAllTemplateNotes: vi.fn(),
  getAllTimeEntries: vi.fn(),
  getAllWorkTypes: vi.fn(),
  getAllWorkUnitDefinitions: vi.fn(),
  getCrewPool: vi.fn(),
  getDB: vi.fn(),
  getGlobalTagSequence: vi.fn(),
}));

vi.mock('../download-json', () => ({
  downloadJson: vi.fn(),
}));

vi.mock('../../attribution/cache', () => ({
  invalidateAttributionCache: vi.fn(),
}));

vi.mock('../../sync/sync-queue', () => ({
  getPendingCount: vi.fn(),
}));

vi.mock('../../types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../types')>();
  return {
    ...actual,
    nowUtc: vi.fn(),
  };
});

const mockedNowUtc = vi.mocked(nowUtc);
const mockedDownloadJson = vi.mocked(downloadJson);
const mockedGetDB = vi.mocked(getDB);
const mockedInvalidateAttributionCache = vi.mocked(invalidateAttributionCache);
const mockedGetPendingCount = vi.mocked(getPendingCount);

function makeEnvelope(
  overrides: Partial<FullBackupPayload> = {},
): DataTransferEnvelope<FullBackupPayload> {
  return {
    schemaVersion: '4.0',
    exportType: 'full-backup',
    exportedAt: '2026-03-22T10:00:00.000Z',
    appVersion: '0.0.1',
    payload: {
      snapshotFormatVersion: FULL_BACKUP_SNAPSHOT_FORMAT_VERSION,
      idbSchemaVersion: DB_VERSION,
      activeTimers: [{ id: 'timer-1', taskId: 'task-1', startUtc: '2026-03-22T08:00:00.000Z', source: 'manual', workers: 2 }],
      timeEntries: [{ id: 'entry-1', taskId: 'task-1', startUtc: '2026-03-22T08:00:00.000Z', endUtc: '2026-03-22T09:00:00.000Z', source: 'manual', workers: 2, syncStatus: 'synced', createdAt: '2026-03-22T09:00:00.000Z', updatedAt: '2026-03-22T09:00:00.000Z' }],
      tasks: [{ id: 'task-1', title: 'Install floor', status: 'active', projectId: 'project-1', parentId: null, blockReason: null, estimatedMinutes: null, workQuantity: 10, workUnit: 'm2', crew: 2, targetProductivity: null, phase: 'assembly', workTypeId: 'work-type-1', createdAt: '2026-03-22T07:00:00.000Z', updatedAt: '2026-03-22T07:30:00.000Z', archivedAt: null, archiveVersion: null, sourcePlanId: 'plan-1', sourceLineItemId: 'line-1', excludeFromKpi: false }],
      projects: [{ id: 'project-1', name: 'Expo Hall', color: '#2563eb', createdAt: '2026-03-22T06:00:00.000Z', updatedAt: '2026-03-22T06:00:00.000Z', assemblyStartDate: null, assemblyEndDate: null, dismantleStartDate: null, dismantleEndDate: null, eventStartDate: null, eventEndDate: null }],
      taskNotes: [{ id: 'note-1', taskId: 'task-1', text: 'Started', createdAt: '2026-03-22T08:05:00.000Z' }],
      templateNotes: [{ id: 'template-note-1', templateId: 'template-1', text: 'Template note', createdAt: '2026-03-22T08:06:00.000Z' }],
      taskTemplates: [{ id: 'template-1', title: 'Template', workTypeId: 'work-type-1', workUnit: 'm2', workQuantity: 20, estimatedMinutes: 60, crew: 2, targetProductivity: null, phase: 'assembly', createdAt: '2026-03-22T07:00:00.000Z', updatedAt: '2026-03-22T07:00:00.000Z' }],
      attributionSnapshots: [{
        id: 'soft_allow_flag',
        policy: 'soft_allow_flag',
        computedAt: '2026-03-22T09:30:00.000Z',
        results: [],
        summary: {
          engineVersion: 'v1',
          totalEntries: 1,
          attributed: 1,
          unattributed: 0,
          ambiguous: 0,
          totalPersonHours: 2,
          attributedPersonHours: 2,
          excludedPersonHours: 0,
          ambiguousSuggestedResolutions: 0,
          ambiguousResolvedByPolicy: 0,
        },
      }],
      plans: [{ id: 'plan-1', title: 'Expo plan', status: 'active', lineItems: [], projectId: 'project-1', eventStartDate: null, eventEndDate: null, assemblyStartDate: null, assemblyEndDate: null, dismantleStartDate: null, dismantleEndDate: null, defaultCrewSize: 4, defaultEfficiency: null, workCalendar: [], createdAt: '2026-03-22T06:30:00.000Z', updatedAt: '2026-03-22T06:30:00.000Z', activatedAt: null, reviewedAt: null, importedAt: null, sessionClosedAt: null, lastExecutionReturnExportedAt: null }],
      workTypes: [{ id: 'work-type-1', title: 'Flooring', workUnit: 'm2', assemblyRate: 10, dismantleRate: 5, tagIds: [], createdAt: '2026-03-22T06:00:00.000Z', updatedAt: '2026-03-22T06:00:00.000Z' }],
      workUnitDefinitions: [{ id: 'm2', label: 'm²', sortIndex: 0, createdAt: '2026-03-22T06:00:00.000Z', updatedAt: '2026-03-22T06:00:00.000Z', archivedAt: null, builtIn: true }],
      executionReturns: [{ id: 'return-1', planId: 'plan-1', planTitle: 'Expo plan', closedAt: '2026-03-22T10:00:00.000Z', importedAt: '2026-03-22T10:30:00.000Z', schemaVersion: '4.0', appVersion: '0.0.1', exportType: 'execution-return', exportedAt: '2026-03-22T10:00:00.000Z', mergeSummary: { importedAt: '2026-03-22T10:30:00.000Z', importedEntryCount: 1, skippedDuplicateEntryCount: 0, mergedTaskCount: 1, lineItemCount: 1 } }],
      executionReturnLineItems: [{ id: 'return-1:line-1:assembly', executionReturnId: 'return-1', planId: 'plan-1', importedAt: '2026-03-22T10:30:00.000Z', lineItemId: 'line-1', phase: 'assembly', sourceWorkPackageId: 'line-1', title: 'Install floor', executionStatus: 'completed', blockReason: null, blockCategory: null, executorNote: null, deferredNote: null, removedFromSource: false, scheduledStart: null, scheduledEnd: null, actualStartDate: null, actualEndDate: null, deadlineStatusAtClose: null }],
      executionReturnUnplannedTasks: [{ id: 'return-1:task-u-1', executionReturnId: 'return-1', planId: 'plan-1', importedAt: '2026-03-22T10:30:00.000Z', taskId: 'task-u-1', title: 'Cleanup', workTypeId: null, workUnit: null, phase: null, personHours: 1 }],
      tagCategories: [{ id: 'category-1', name: 'Zone', sortOrder: 0, createdAt: '2026-03-22T06:00:00.000Z', updatedAt: '2026-03-22T06:00:00.000Z' }],
      tags: [{ id: 'tag-1', categoryId: 'category-1', name: 'North', color: '#2563eb', sequencable: true, skillTag: false, createdAt: '2026-03-22T06:00:00.000Z', updatedAt: '2026-03-22T06:00:00.000Z' }],
      globalTagSequence: { id: 'global', tagIds: ['tag-1'], updatedAt: '2026-03-22T06:00:00.000Z' },
      crewPool: { id: 'global', allocations: { 'tag-1': 4 }, updatedAt: '2026-03-22T06:00:00.000Z' },
      ...overrides,
    },
  };
}

describe('full-backup transfer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedNowUtc.mockReturnValue('2026-03-22T10:00:00.000Z');

    vi.mocked(getAllActiveTimers).mockResolvedValue([]);
    vi.mocked(getAllTimeEntries).mockResolvedValue([]);
    vi.mocked(getAllTasks).mockResolvedValue([]);
    vi.mocked(getAllProjects).mockResolvedValue([]);
    vi.mocked(getAllTaskNotes).mockResolvedValue([]);
    vi.mocked(getAllTemplateNotes).mockResolvedValue([]);
    vi.mocked(getAllTaskTemplates).mockResolvedValue([]);
    vi.mocked(getAllAttributionSnapshots).mockResolvedValue([]);
    vi.mocked(getAllPlans).mockResolvedValue([]);
    vi.mocked(getAllWorkTypes).mockResolvedValue([]);
    vi.mocked(getAllWorkUnitDefinitions).mockResolvedValue([]);
    vi.mocked(getAllExecutionReturns).mockResolvedValue([]);
    vi.mocked(getAllExecutionReturnLineItems).mockResolvedValue([]);
    vi.mocked(getAllExecutionReturnUnplannedTasks).mockResolvedValue([]);
    vi.mocked(getAllTagCategories).mockResolvedValue([]);
    vi.mocked(getAllTags).mockResolvedValue([]);
    vi.mocked(getGlobalTagSequence).mockResolvedValue(undefined);
    vi.mocked(getCrewPool).mockResolvedValue(undefined);
    mockedInvalidateAttributionCache.mockResolvedValue(undefined);
    mockedGetPendingCount.mockResolvedValue(0);
  });

  it('parses a valid full-backup export', () => {
    const parsed = parseFullBackupJson(JSON.stringify(makeEnvelope()));
    expect(parsed.ok).toBe(true);
  });

  it('rejects a non-full-backup export', () => {
    const parsed = parseFullBackupJson(JSON.stringify({
      ...makeEnvelope(),
      exportType: 'plan-package',
    }));
    expect(parsed).toEqual({
      ok: false,
      error: 'Selected file is not a full backup export.',
    });
  });

  it('rejects an unsupported envelope schema version', () => {
    const parsed = parseFullBackupJson(JSON.stringify({
      ...makeEnvelope(),
      schemaVersion: '9.0',
    }));
    expect(parsed).toEqual({
      ok: false,
      error: 'Unsupported full-backup schema version: 9.0. Only schema 3.0, 4.0 is supported.',
    });
  });

  it('rejects an unsupported snapshot format version', () => {
    const parsed = parseFullBackupJson(JSON.stringify(makeEnvelope({
      snapshotFormatVersion: 2,
    })));
    expect(parsed).toEqual({
      ok: false,
      error: 'Unsupported full-backup snapshot format version: 2.',
    });
  });

  it('builds preview counts for all payload sections', async () => {
    const preview = await previewFullBackupImport(makeEnvelope());
    expect(preview.counts).toEqual({
      activeTimers: 1,
      timeEntries: 1,
      tasks: 1,
      projects: 1,
      taskNotes: 1,
      templateNotes: 1,
      taskTemplates: 1,
      attributionSnapshots: 1,
      plans: 1,
      workTypes: 1,
      workUnitDefinitions: 1,
      executionReturns: 1,
      executionReturnLineItems: 1,
      executionReturnUnplannedTasks: 1,
      tagCategories: 1,
      tags: 1,
      globalTagSequence: 1,
      crewPool: 1,
    });
    expect(preview.isCompatible).toBe(true);
    expect(preview.warnings).toEqual([]);
  });

  it('uses one manifest to define all backup stores', () => {
    expect(FULL_BACKUP_STORE_MANIFEST).toHaveLength(18);
    expect(FULL_BACKUP_STORE_MANIFEST.map((entry) => entry.payloadKey)).toEqual([
      'activeTimers',
      'timeEntries',
      'tasks',
      'projects',
      'taskNotes',
      'templateNotes',
      'taskTemplates',
      'attributionSnapshots',
      'plans',
      'workTypes',
      'workUnitDefinitions',
      'executionReturns',
      'executionReturnLineItems',
      'executionReturnUnplannedTasks',
      'tagCategories',
      'tags',
      'globalTagSequence',
      'crewPool',
    ]);
  });

  it('blocks apply when the backup schema version mismatches', async () => {
    const preview = await previewFullBackupImport(makeEnvelope({
      idbSchemaVersion: DB_VERSION - 1,
    }));

    await expect(applyFullBackupImport(preview)).rejects.toThrow(
      `This backup targets IndexedDB schema ${DB_VERSION - 1}, but this app uses schema ${DB_VERSION}. Import is blocked.`,
    );
    expect(mockedGetDB).not.toHaveBeenCalled();
  });

  it('exports a full backup using the current DB version', async () => {
    vi.mocked(getAllTasks).mockResolvedValue(makeEnvelope().payload.tasks);
    vi.mocked(getAllProjects).mockResolvedValue(makeEnvelope().payload.projects);

    await exportFullBackupToFile();

    expect(mockedDownloadJson).toHaveBeenCalledWith(
      'time-tracking-full-backup-2026-03-22.json',
      expect.objectContaining({
        exportType: 'full-backup',
        payload: expect.objectContaining({
          idbSchemaVersion: DB_VERSION,
          snapshotFormatVersion: FULL_BACKUP_SNAPSHOT_FORMAT_VERSION,
        }),
      }),
    );
  });

  it('includes the current DB version in the exported envelope', async () => {
    const envelope = await buildFullBackupEnvelope();
    expect(envelope.payload.idbSchemaVersion).toBe(DB_VERSION);
    expect(envelope.payload.globalTagSequence).toBeNull();
    expect(envelope.payload.crewPool).toBeNull();
  });

  it('replaces all stores with the imported snapshot', async () => {
    const envelope = makeEnvelope();
    const storeState = new Map<string, unknown[]>([
      ['activeTimers', [{ id: 'stale-timer' }]],
      ['timeEntries', [{ id: 'stale-entry' }]],
      ['tasks', [{ id: 'stale-task' }]],
      ['projects', [{ id: 'stale-project' }]],
      ['taskNotes', [{ id: 'stale-note' }]],
      ['templateNotes', [{ id: 'stale-template-note' }]],
      ['taskTemplates', [{ id: 'stale-template' }]],
      ['attributionSnapshots', [{ id: 'stale', policy: 'soft_allow_flag' }]],
      ['plans', [{ id: 'stale-plan' }]],
      ['workTypes', [{ id: 'stale-work-type' }]],
      ['workUnitDefinitions', [{ id: 'stale-unit' }]],
      ['executionReturns', [{ id: 'stale-return' }]],
      ['executionReturnLineItems', [{ id: 'stale-line' }]],
      ['executionReturnUnplannedTasks', [{ id: 'stale-unplanned' }]],
      ['tagCategories', [{ id: 'stale-category' }]],
      ['tags', [{ id: 'stale-tag' }]],
      ['globalTagSequence', [{ id: 'stale-global' }]],
      ['crewPool', [{ id: 'stale-crew' }]],
    ]);

    const tx = {
      objectStore: vi.fn((storeName: string) => ({
        clear: vi.fn(async () => {
          storeState.set(storeName, []);
        }),
        put: vi.fn(async (value: unknown) => {
          storeState.set(storeName, [...(storeState.get(storeName) ?? []), value]);
        }),
      })),
      done: Promise.resolve(),
      abort: vi.fn(),
    };

    mockedGetDB.mockResolvedValue({
      transaction: vi.fn(() => tx),
    } as unknown as Awaited<ReturnType<typeof getDB>>);

    const preview = await previewFullBackupImport(envelope);
    const result = await applyFullBackupImport(preview);

    expect(result.reason).toBe('Imported full backup. The page will reload.');
    expect(storeState.get('taskNotes')).toEqual(envelope.payload.taskNotes);
    expect(storeState.get('templateNotes')).toEqual(envelope.payload.templateNotes);
    expect(storeState.get('executionReturns')).toEqual(envelope.payload.executionReturns);
    expect(storeState.get('executionReturnLineItems')).toEqual(envelope.payload.executionReturnLineItems);
    expect(storeState.get('executionReturnUnplannedTasks')).toEqual(envelope.payload.executionReturnUnplannedTasks);
    expect(storeState.get('activeTimers')).toEqual(envelope.payload.activeTimers);
    expect(storeState.get('attributionSnapshots')).toEqual(envelope.payload.attributionSnapshots);
    expect(storeState.get('globalTagSequence')).toEqual([envelope.payload.globalTagSequence]);
    expect(storeState.get('crewPool')).toEqual([envelope.payload.crewPool]);
    expect(mockedInvalidateAttributionCache).toHaveBeenCalledTimes(1);
    expect(mockedGetPendingCount).toHaveBeenCalledTimes(1);
  });
});

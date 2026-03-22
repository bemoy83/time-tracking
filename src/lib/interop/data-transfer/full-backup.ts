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
import { invalidateAttributionCache } from '../../attribution/cache';
import { downloadJson } from '../download-json';
import { getPendingCount } from '../../sync/sync-queue';
import { nowUtc } from '../../types';
import {
  FULL_BACKUP_SNAPSHOT_FORMAT_VERSION,
  type DataTransferEnvelope,
  type FullBackupEntityCounts,
  type FullBackupImportPreview,
  type FullBackupImportResult,
  type FullBackupPayload,
} from './contracts';
import {
  isSupportedSchemaVersion,
  unsupportedSchemaVersionMessage,
} from './schema-version';

const FULL_BACKUP_STORE_NAMES = [
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
] as const;

const FULL_BACKUP_INSERT_ORDER = [
  'tagCategories',
  'tags',
  'globalTagSequence',
  'crewPool',
  'workUnitDefinitions',
  'workTypes',
  'projects',
  'plans',
  'tasks',
  'timeEntries',
  'taskNotes',
  'templateNotes',
  'taskTemplates',
  'executionReturns',
  'executionReturnLineItems',
  'executionReturnUnplannedTasks',
  'activeTimers',
  'attributionSnapshots',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

function isFullBackupPayload(value: unknown): value is FullBackupPayload {
  if (!isRecord(value)) return false;
  if (typeof value.snapshotFormatVersion !== 'number') return false;
  if (typeof value.idbSchemaVersion !== 'number') return false;

  for (const key of FULL_BACKUP_STORE_NAMES) {
    if (!(key in value)) return false;
  }

  return (
    Array.isArray(value.activeTimers)
    && Array.isArray(value.timeEntries)
    && Array.isArray(value.tasks)
    && Array.isArray(value.projects)
    && Array.isArray(value.taskNotes)
    && Array.isArray(value.templateNotes)
    && Array.isArray(value.taskTemplates)
    && Array.isArray(value.attributionSnapshots)
    && Array.isArray(value.plans)
    && Array.isArray(value.workTypes)
    && Array.isArray(value.workUnitDefinitions)
    && Array.isArray(value.executionReturns)
    && Array.isArray(value.executionReturnLineItems)
    && Array.isArray(value.executionReturnUnplannedTasks)
    && Array.isArray(value.tagCategories)
    && Array.isArray(value.tags)
    && isNullableRecord(value.globalTagSequence)
    && isNullableRecord(value.crewPool)
  );
}

function buildEntityCounts(payload: FullBackupPayload): FullBackupEntityCounts {
  return {
    activeTimers: payload.activeTimers.length,
    timeEntries: payload.timeEntries.length,
    tasks: payload.tasks.length,
    projects: payload.projects.length,
    taskNotes: payload.taskNotes.length,
    templateNotes: payload.templateNotes.length,
    taskTemplates: payload.taskTemplates.length,
    attributionSnapshots: payload.attributionSnapshots.length,
    plans: payload.plans.length,
    workTypes: payload.workTypes.length,
    workUnitDefinitions: payload.workUnitDefinitions.length,
    executionReturns: payload.executionReturns.length,
    executionReturnLineItems: payload.executionReturnLineItems.length,
    executionReturnUnplannedTasks: payload.executionReturnUnplannedTasks.length,
    tagCategories: payload.tagCategories.length,
    tags: payload.tags.length,
    globalTagSequence: payload.globalTagSequence ? 1 : 0,
    crewPool: payload.crewPool ? 1 : 0,
  };
}

export async function buildFullBackupEnvelope(): Promise<DataTransferEnvelope<FullBackupPayload>> {
  const exportedAt = nowUtc();
  const [
    activeTimers,
    timeEntries,
    tasks,
    projects,
    taskNotes,
    templateNotes,
    taskTemplates,
    attributionSnapshots,
    plans,
    workTypes,
    workUnitDefinitions,
    executionReturns,
    executionReturnLineItems,
    executionReturnUnplannedTasks,
    tagCategories,
    tags,
    globalTagSequence,
    crewPool,
  ] = await Promise.all([
    getAllActiveTimers(),
    getAllTimeEntries(),
    getAllTasks(),
    getAllProjects(),
    getAllTaskNotes(),
    getAllTemplateNotes(),
    getAllTaskTemplates(),
    getAllAttributionSnapshots(),
    getAllPlans(),
    getAllWorkTypes(),
    getAllWorkUnitDefinitions(),
    getAllExecutionReturns(),
    getAllExecutionReturnLineItems(),
    getAllExecutionReturnUnplannedTasks(),
    getAllTagCategories(),
    getAllTags(),
    getGlobalTagSequence(),
    getCrewPool(),
  ]);

  return {
    schemaVersion: '4.0',
    exportType: 'full-backup',
    exportedAt,
    appVersion: '0.0.1',
    payload: {
      snapshotFormatVersion: FULL_BACKUP_SNAPSHOT_FORMAT_VERSION,
      idbSchemaVersion: DB_VERSION,
      activeTimers,
      timeEntries,
      tasks,
      projects,
      taskNotes,
      templateNotes,
      taskTemplates,
      attributionSnapshots,
      plans,
      workTypes,
      workUnitDefinitions,
      executionReturns,
      executionReturnLineItems,
      executionReturnUnplannedTasks,
      tagCategories,
      tags,
      globalTagSequence: globalTagSequence ?? null,
      crewPool: crewPool ?? null,
    },
  };
}

export async function exportFullBackupToFile(): Promise<void> {
  const envelope = await buildFullBackupEnvelope();
  const filename = `time-tracking-full-backup-${envelope.exportedAt.slice(0, 10)}.json`;
  downloadJson(filename, envelope);
}

export function parseFullBackupJson(
  text: string,
): { ok: true; envelope: DataTransferEnvelope<FullBackupPayload> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, error: 'Invalid JSON structure.' };
    }
    if (parsed.exportType !== 'full-backup') {
      return { ok: false, error: 'Selected file is not a full backup export.' };
    }
    if (!isSupportedSchemaVersion(String(parsed.schemaVersion))) {
      return {
        ok: false,
        error: unsupportedSchemaVersionMessage(String(parsed.schemaVersion), 'full-backup'),
      };
    }
    if (!isFullBackupPayload(parsed.payload)) {
      return { ok: false, error: 'Invalid full backup payload.' };
    }
    if (parsed.payload.snapshotFormatVersion !== FULL_BACKUP_SNAPSHOT_FORMAT_VERSION) {
      return {
        ok: false,
        error: `Unsupported full-backup snapshot format version: ${parsed.payload.snapshotFormatVersion}.`,
      };
    }
    return {
      ok: true,
      envelope: parsed as unknown as DataTransferEnvelope<FullBackupPayload>,
    };
  } catch {
    return { ok: false, error: 'Could not parse JSON file.' };
  }
}

export async function previewFullBackupImport(
  envelope: DataTransferEnvelope<FullBackupPayload>,
): Promise<FullBackupImportPreview> {
  const warnings: string[] = [];
  const isCompatible = envelope.payload.idbSchemaVersion === DB_VERSION;

  if (!isCompatible) {
    warnings.push(
      `This backup targets IndexedDB schema ${envelope.payload.idbSchemaVersion}, but this app uses schema ${DB_VERSION}. Import is blocked.`,
    );
  }

  return {
    exportedAt: envelope.exportedAt,
    schemaVersion: envelope.schemaVersion,
    appVersion: envelope.appVersion,
    snapshotFormatVersion: envelope.payload.snapshotFormatVersion,
    idbSchemaVersion: envelope.payload.idbSchemaVersion,
    counts: buildEntityCounts(envelope.payload),
    warnings,
    isCompatible,
    envelope,
  };
}

async function clearStore(
  tx: any,
  storeName: (typeof FULL_BACKUP_STORE_NAMES)[number],
): Promise<void> {
  await tx.objectStore(storeName).clear();
}

async function putMany(
  tx: any,
  storeName: (typeof FULL_BACKUP_STORE_NAMES)[number],
  records: unknown[],
): Promise<void> {
  const store = tx.objectStore(storeName);
  for (const record of records) {
    await store.put(record);
  }
}

export async function applyFullBackupImport(
  preview: FullBackupImportPreview,
): Promise<FullBackupImportResult> {
  if (!preview.isCompatible) {
    throw new Error(preview.warnings[0] ?? 'This full backup is not compatible with the current app version.');
  }

  const { payload } = preview.envelope;
  const db = await getDB();
  const tx = db.transaction(FULL_BACKUP_STORE_NAMES, 'readwrite');

  try {
    for (const storeName of FULL_BACKUP_STORE_NAMES) {
      await clearStore(tx, storeName);
    }

    await putMany(tx, 'tagCategories', payload.tagCategories);
    await putMany(tx, 'tags', payload.tags);
    if (payload.globalTagSequence) {
      await tx.objectStore('globalTagSequence').put(payload.globalTagSequence);
    }
    if (payload.crewPool) {
      await tx.objectStore('crewPool').put(payload.crewPool);
    }
    for (const storeName of FULL_BACKUP_INSERT_ORDER) {
      switch (storeName) {
        case 'tagCategories':
        case 'tags':
        case 'globalTagSequence':
        case 'crewPool':
          break;
        case 'workUnitDefinitions':
          await putMany(tx, storeName, payload.workUnitDefinitions);
          break;
        case 'workTypes':
          await putMany(tx, storeName, payload.workTypes);
          break;
        case 'projects':
          await putMany(tx, storeName, payload.projects);
          break;
        case 'plans':
          await putMany(tx, storeName, payload.plans);
          break;
        case 'tasks':
          await putMany(tx, storeName, payload.tasks);
          break;
        case 'timeEntries':
          await putMany(tx, storeName, payload.timeEntries);
          break;
        case 'taskNotes':
          await putMany(tx, storeName, payload.taskNotes);
          break;
        case 'templateNotes':
          await putMany(tx, storeName, payload.templateNotes);
          break;
        case 'taskTemplates':
          await putMany(tx, storeName, payload.taskTemplates);
          break;
        case 'executionReturns':
          await putMany(tx, storeName, payload.executionReturns);
          break;
        case 'executionReturnLineItems':
          await putMany(tx, storeName, payload.executionReturnLineItems);
          break;
        case 'executionReturnUnplannedTasks':
          await putMany(tx, storeName, payload.executionReturnUnplannedTasks);
          break;
        case 'activeTimers':
          await putMany(tx, storeName, payload.activeTimers);
          break;
        case 'attributionSnapshots':
          await putMany(tx, storeName, payload.attributionSnapshots);
          break;
      }
    }

    await tx.done;
  } catch (error) {
    tx.abort();
    throw error;
  }

  await invalidateAttributionCache();
  await getPendingCount();

  return {
    restoredAt: nowUtc(),
    counts: buildEntityCounts(payload),
    reason: 'Imported full backup. The page will reload.',
  };
}

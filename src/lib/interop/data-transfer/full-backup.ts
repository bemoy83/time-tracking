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
  type TimeTrackingDBSchema,
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
  assertSupportedTransferSchemaVersion,
  assertTransferExportType,
  createTransferEnvelope,
  parseJsonRecord,
} from './transfer-core';

type FullBackupStoreName = Exclude<
  keyof FullBackupPayload,
  'snapshotFormatVersion' | 'idbSchemaVersion'
>;

type CollectionStoreName = {
  [K in FullBackupStoreName]: FullBackupPayload[K] extends Array<unknown> ? K : never;
}[FullBackupStoreName];

type SingletonStoreName = Exclude<FullBackupStoreName, CollectionStoreName>;

type FullBackupTransaction = {
  objectStore<K extends FullBackupStoreName>(storeName: K): {
    clear: () => Promise<unknown>;
    put: (value: TimeTrackingDBSchema[K]['value']) => Promise<unknown>;
  };
  done: Promise<unknown>;
  abort: () => void;
};

type CollectionManifestEntry<K extends CollectionStoreName> = {
  storeName: K;
  payloadKey: K;
  kind: 'collection';
  order: number;
  read: () => Promise<FullBackupPayload[K]>;
  clear: (tx: FullBackupTransaction) => Promise<void>;
  restore: (tx: FullBackupTransaction, value: FullBackupPayload[K]) => Promise<void>;
  count: (value: FullBackupPayload[K]) => number;
};

type SingletonManifestEntry<K extends SingletonStoreName> = {
  storeName: K;
  payloadKey: K;
  kind: 'singleton';
  order: number;
  read: () => Promise<FullBackupPayload[K]>;
  clear: (tx: FullBackupTransaction) => Promise<void>;
  restore: (tx: FullBackupTransaction, value: FullBackupPayload[K]) => Promise<void>;
  count: (value: FullBackupPayload[K]) => number;
};

type ManifestEntryForKey<K extends FullBackupStoreName> =
  K extends CollectionStoreName
    ? CollectionManifestEntry<K>
    : SingletonManifestEntry<Extract<K, SingletonStoreName>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

async function clearStore<K extends FullBackupStoreName>(
  tx: FullBackupTransaction,
  storeName: K,
): Promise<void> {
  await tx.objectStore(storeName).clear();
}

async function restoreCollectionStore<K extends CollectionStoreName>(
  tx: FullBackupTransaction,
  storeName: K,
  value: FullBackupPayload[K],
): Promise<void> {
  const store = tx.objectStore(storeName);
  for (const record of value) {
    await store.put(record as TimeTrackingDBSchema[K]['value']);
  }
}

async function restoreSingletonStore<K extends SingletonStoreName>(
  tx: FullBackupTransaction,
  storeName: K,
  value: FullBackupPayload[K],
): Promise<void> {
  if (!value) return;
  await tx.objectStore(storeName).put(value as TimeTrackingDBSchema[K]['value']);
}

function createCollectionManifestEntry<K extends CollectionStoreName>(
  storeName: K,
  order: number,
  read: () => Promise<FullBackupPayload[K]>,
): CollectionManifestEntry<K> {
  return {
    storeName,
    payloadKey: storeName,
    kind: 'collection',
    order,
    read,
    clear: async (tx) => clearStore(tx, storeName),
    restore: async (tx, value) => restoreCollectionStore(tx, storeName, value),
    count: (value) => value.length,
  };
}

function createSingletonManifestEntry<K extends SingletonStoreName>(
  storeName: K,
  order: number,
  read: () => Promise<FullBackupPayload[K]>,
): SingletonManifestEntry<K> {
  return {
    storeName,
    payloadKey: storeName,
    kind: 'singleton',
    order,
    read,
    clear: async (tx) => clearStore(tx, storeName),
    restore: async (tx, value) => restoreSingletonStore(tx, storeName, value),
    count: (value) => (value ? 1 : 0),
  };
}

export const FULL_BACKUP_STORE_MANIFEST = [
  createCollectionManifestEntry('activeTimers', 17, getAllActiveTimers),
  createCollectionManifestEntry('timeEntries', 10, getAllTimeEntries),
  createCollectionManifestEntry('tasks', 9, getAllTasks),
  createCollectionManifestEntry('projects', 7, getAllProjects),
  createCollectionManifestEntry('taskNotes', 11, getAllTaskNotes),
  createCollectionManifestEntry('templateNotes', 12, getAllTemplateNotes),
  createCollectionManifestEntry('taskTemplates', 13, getAllTaskTemplates),
  createCollectionManifestEntry('attributionSnapshots', 18, getAllAttributionSnapshots),
  createCollectionManifestEntry('plans', 8, getAllPlans),
  createCollectionManifestEntry('workTypes', 6, getAllWorkTypes),
  createCollectionManifestEntry('workUnitDefinitions', 5, getAllWorkUnitDefinitions),
  createCollectionManifestEntry('executionReturns', 14, getAllExecutionReturns),
  createCollectionManifestEntry('executionReturnLineItems', 15, getAllExecutionReturnLineItems),
  createCollectionManifestEntry('executionReturnUnplannedTasks', 16, getAllExecutionReturnUnplannedTasks),
  createCollectionManifestEntry('tagCategories', 1, getAllTagCategories),
  createCollectionManifestEntry('tags', 2, getAllTags),
  createSingletonManifestEntry('globalTagSequence', 3, async () => (await getGlobalTagSequence()) ?? null),
  createSingletonManifestEntry('crewPool', 4, async () => (await getCrewPool()) ?? null),
] as const;

function visitManifestEntry<TResult>(
  entry: (typeof FULL_BACKUP_STORE_MANIFEST)[number],
  visitor: <K extends FullBackupStoreName>(entry: ManifestEntryForKey<K>) => TResult,
): TResult {
  return visitor(entry as never);
}

function getManifestPayloadValue<K extends FullBackupStoreName>(
  entry: ManifestEntryForKey<K>,
  payload: FullBackupPayload,
): FullBackupPayload[K] {
  return payload[entry.payloadKey] as FullBackupPayload[K];
}

function countManifestValue<K extends FullBackupStoreName>(
  entry: ManifestEntryForKey<K>,
  payload: FullBackupPayload,
): number {
  const count = entry.count as (value: FullBackupPayload[K]) => number;
  return count(getManifestPayloadValue(entry, payload));
}

async function restoreManifestValue<K extends FullBackupStoreName>(
  entry: ManifestEntryForKey<K>,
  tx: FullBackupTransaction,
  payload: FullBackupPayload,
): Promise<void> {
  const restore = entry.restore as (
    tx: FullBackupTransaction,
    value: FullBackupPayload[K],
  ) => Promise<void>;
  await restore(tx, getManifestPayloadValue(entry, payload));
}

function buildEntityCounts(payload: FullBackupPayload): FullBackupEntityCounts {
  const counts: Partial<FullBackupEntityCounts> = {};

  for (const entry of FULL_BACKUP_STORE_MANIFEST) {
    const [key, count] = visitManifestEntry(entry, (specificEntry) => [
      specificEntry.payloadKey,
      countManifestValue(specificEntry, payload),
    ] as const);
    counts[key] = count;
  }

  return counts as FullBackupEntityCounts;
}

function isFullBackupPayload(value: unknown): value is FullBackupPayload {
  if (!isRecord(value)) return false;
  if (typeof value.snapshotFormatVersion !== 'number') return false;
  if (typeof value.idbSchemaVersion !== 'number') return false;

  for (const entry of FULL_BACKUP_STORE_MANIFEST) {
    const storeValue = value[entry.payloadKey];
    if (entry.kind === 'collection' && !Array.isArray(storeValue)) {
      return false;
    }
    if (entry.kind === 'singleton' && !isNullableRecord(storeValue)) {
      return false;
    }
  }

  return true;
}

async function readFullBackupPayloadStores(): Promise<Pick<FullBackupPayload, FullBackupStoreName>> {
  const values = await Promise.all(
    FULL_BACKUP_STORE_MANIFEST.map(async (entry) => [entry.payloadKey, await entry.read()] as const),
  );
  return Object.fromEntries(values) as Pick<FullBackupPayload, FullBackupStoreName>;
}

export async function buildFullBackupEnvelope(): Promise<DataTransferEnvelope<FullBackupPayload>> {
  const exportedAt = nowUtc();
  const payloadStores = await readFullBackupPayloadStores();
  return createTransferEnvelope(
    'full-backup',
    {
      snapshotFormatVersion: FULL_BACKUP_SNAPSHOT_FORMAT_VERSION,
      idbSchemaVersion: DB_VERSION,
      ...payloadStores,
    },
    exportedAt,
  );
}

export async function exportFullBackupToFile(): Promise<void> {
  const envelope = await buildFullBackupEnvelope();
  const filename = `time-tracking-full-backup-${envelope.exportedAt.slice(0, 10)}.json`;
  downloadJson(filename, envelope);
}

export function parseFullBackupJson(
  text: string,
): { ok: true; envelope: DataTransferEnvelope<FullBackupPayload> } | { ok: false; error: string } {
  const parsedResult = parseJsonRecord(text);
  if (!parsedResult.ok) {
    return {
      ok: false,
      error: parsedResult.error === 'invalid-json' ? 'Could not parse JSON file.' : 'Invalid JSON structure.',
    };
  }
  const parsed = parsedResult.value;
  if (!assertTransferExportType(parsed, 'full-backup')) {
    return { ok: false, error: 'Selected file is not a full backup export.' };
  }
  const schemaVersionCheck = assertSupportedTransferSchemaVersion(
    String(parsed.schemaVersion),
    'full-backup',
  );
  if (!schemaVersionCheck.ok) {
    return { ok: false, error: schemaVersionCheck.error };
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

export async function applyFullBackupImport(
  preview: FullBackupImportPreview,
): Promise<FullBackupImportResult> {
  if (!preview.isCompatible) {
    throw new Error(preview.warnings[0] ?? 'This full backup is not compatible with the current app version.');
  }

  const { payload } = preview.envelope;
  const db = await getDB();
  const tx = db.transaction(
    FULL_BACKUP_STORE_MANIFEST.map((entry) => entry.storeName),
    'readwrite',
  ) as unknown as FullBackupTransaction;

  try {
    for (const entry of FULL_BACKUP_STORE_MANIFEST) {
      await entry.clear(tx);
    }

    for (const entry of [...FULL_BACKUP_STORE_MANIFEST].sort((a, b) => a.order - b.order)) {
      await visitManifestEntry(entry, (specificEntry) => restoreManifestValue(specificEntry, tx, payload));
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

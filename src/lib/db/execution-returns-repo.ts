import type {
  ExecutionReturnMergeSummary,
  ImportedExecutionReturnLineItemRecord,
  ImportedExecutionReturnRecord,
  ImportedExecutionReturnUnplannedTaskRecord,
} from '../interop/data-transfer/contracts';
import { getDB } from './core';

function normalizeExecutionReturnMergeSummary(
  summary: Partial<ExecutionReturnMergeSummary> | undefined,
  importedAt: string,
): ExecutionReturnMergeSummary {
  return {
    importedAt: typeof summary?.importedAt === 'string' && summary.importedAt.length > 0
      ? summary.importedAt
      : importedAt,
    importedEntryCount: typeof summary?.importedEntryCount === 'number' ? summary.importedEntryCount : 0,
    skippedDuplicateEntryCount: typeof summary?.skippedDuplicateEntryCount === 'number' ? summary.skippedDuplicateEntryCount : 0,
    mergedTaskCount: typeof summary?.mergedTaskCount === 'number' ? summary.mergedTaskCount : 0,
    lineItemCount: typeof summary?.lineItemCount === 'number' ? summary.lineItemCount : 0,
  };
}

function normalizeExecutionReturnRecord(
  raw: ImportedExecutionReturnRecord,
): ImportedExecutionReturnRecord {
  return {
    ...raw,
    mergeSummary: normalizeExecutionReturnMergeSummary(raw.mergeSummary, raw.importedAt),
  };
}

export async function addExecutionReturnRecord(
  record: ImportedExecutionReturnRecord,
): Promise<void> {
  const db = await getDB();
  await db.add('executionReturns', normalizeExecutionReturnRecord(record));
}

export async function addExecutionReturnLineItems(
  records: ImportedExecutionReturnLineItemRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('executionReturnLineItems', 'readwrite');
  await Promise.all([
    ...records.map((record) => tx.store.put(record)),
    tx.done,
  ]);
}

export async function addExecutionReturnUnplannedTasks(
  records: ImportedExecutionReturnUnplannedTaskRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('executionReturnUnplannedTasks', 'readwrite');
  await Promise.all([
    ...records.map((record) => tx.store.put(record)),
    tx.done,
  ]);
}

export async function getExecutionReturnsByPlanId(
  planId: string,
): Promise<ImportedExecutionReturnRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('executionReturns', 'by-plan', planId);
  return records
    .map(normalizeExecutionReturnRecord)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getAllExecutionReturns(): Promise<ImportedExecutionReturnRecord[]> {
  const db = await getDB();
  return (await db.getAll('executionReturns'))
    .map(normalizeExecutionReturnRecord)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getLatestExecutionReturnByPlanId(
  planId: string,
): Promise<ImportedExecutionReturnRecord | null> {
  const records = await getExecutionReturnsByPlanId(planId);
  return records[0] ?? null;
}

/** Returns plan IDs that have at least one imported execution return (for wrap-up eligibility). */
export async function getPlanIdsWithImportedExecutionReturns(): Promise<string[]> {
  const db = await getDB();
  const records = await db.getAll('executionReturns');
  return [...new Set(records.map((r) => r.planId))];
}

export interface LatestExecutionReturnSummaryByPlan {
  executionReturnId: string;
  planId: string;
  planTitle: string;
  importedAt: string;
  mergeSummary: ExecutionReturnMergeSummary;
}

export async function getLatestExecutionReturnSummaryByPlanId(
  planId: string,
): Promise<LatestExecutionReturnSummaryByPlan | null> {
  const record = await getLatestExecutionReturnByPlanId(planId);
  if (!record) return null;
  return {
    executionReturnId: record.id,
    planId: record.planId,
    planTitle: record.planTitle,
    importedAt: record.importedAt,
    mergeSummary: record.mergeSummary,
  };
}

export async function getLatestExecutionReturnSummariesByPlanIds(
  planIds: string[],
): Promise<Map<string, LatestExecutionReturnSummaryByPlan>> {
  const wantedPlanIds = new Set(planIds);
  const result = new Map<string, LatestExecutionReturnSummaryByPlan>();
  if (wantedPlanIds.size === 0) return result;

  const db = await getDB();
  const records = (await db.getAll('executionReturns')).map(normalizeExecutionReturnRecord);
  records.sort((a, b) => b.importedAt.localeCompare(a.importedAt));

  for (const record of records) {
    if (!wantedPlanIds.has(record.planId) || result.has(record.planId)) continue;
    result.set(record.planId, {
      executionReturnId: record.id,
      planId: record.planId,
      planTitle: record.planTitle,
      importedAt: record.importedAt,
      mergeSummary: record.mergeSummary,
    });
  }

  return result;
}

export async function getExecutionReturnLineItemsByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnLineItemRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnLineItems', 'by-return', executionReturnId);
}

export async function getAllExecutionReturnLineItems(): Promise<ImportedExecutionReturnLineItemRecord[]> {
  const db = await getDB();
  return db.getAll('executionReturnLineItems');
}

export async function getExecutionReturnUnplannedTasksByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnUnplannedTaskRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnUnplannedTasks', 'by-return', executionReturnId);
}

export async function getAllExecutionReturnUnplannedTasks(): Promise<ImportedExecutionReturnUnplannedTaskRecord[]> {
  const db = await getDB();
  return db.getAll('executionReturnUnplannedTasks');
}

export async function getLatestExecutionReturnBundleByPlanId(
  planId: string,
): Promise<{
  record: ImportedExecutionReturnRecord;
  lineItems: ImportedExecutionReturnLineItemRecord[];
  unplannedTasks: ImportedExecutionReturnUnplannedTaskRecord[];
} | null> {
  const record = await getLatestExecutionReturnByPlanId(planId);
  if (!record) return null;
  const [lineItems, unplannedTasks] = await Promise.all([
    getExecutionReturnLineItemsByReturnId(record.id),
    getExecutionReturnUnplannedTasksByReturnId(record.id),
  ]);
  return {
    record,
    lineItems,
    unplannedTasks,
  };
}

export async function deleteAllExecutionReturnImports(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['executionReturns', 'executionReturnLineItems', 'executionReturnUnplannedTasks'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('executionReturns').clear(),
    tx.objectStore('executionReturnLineItems').clear(),
    tx.objectStore('executionReturnUnplannedTasks').clear(),
    tx.done,
  ]);
}

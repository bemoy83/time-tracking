import type {
  ImportedExecutionReturnLineItemRecord,
  ImportedExecutionReturnRecord,
  ImportedExecutionReturnUnplannedTaskRecord,
} from '../interop/data-transfer/contracts';
import { getDB } from './core';

export async function addExecutionReturnRecord(
  record: ImportedExecutionReturnRecord,
): Promise<void> {
  const db = await getDB();
  await db.add('executionReturns', record);
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
  return records.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
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

export async function getExecutionReturnLineItemsByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnLineItemRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnLineItems', 'by-return', executionReturnId);
}

export async function getExecutionReturnUnplannedTasksByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnUnplannedTaskRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnUnplannedTasks', 'by-return', executionReturnId);
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

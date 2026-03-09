import type { WorkType } from '../types';
import { getDB } from './core';

export async function addWorkType(workType: WorkType): Promise<void> {
  const db = await getDB();
  await db.add('workTypes', workType);
}

export async function getWorkType(id: string): Promise<WorkType | null> {
  const db = await getDB();
  const wt = await db.get('workTypes', id);
  return wt ?? null;
}

export async function getAllWorkTypes(): Promise<WorkType[]> {
  const db = await getDB();
  return db.getAll('workTypes');
}

export async function updateWorkType(workType: WorkType): Promise<void> {
  const db = await getDB();
  await db.put('workTypes', workType);
}

export async function deleteWorkType(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('workTypes', id);
}

/**
 * Delete all work types.
 */
export async function deleteAllWorkTypes(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('workTypes', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function findWorkTypeByKey(
  title: string,
  workUnit: string,
): Promise<WorkType | null> {
  const db = await getDB();
  const result = await db.getFromIndex('workTypes', 'by-title-unit', [title, workUnit]);
  return result ?? null;
}

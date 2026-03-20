import type { WorkUnitDefinition } from '../types';
import { getDB } from './core';

export async function addWorkUnitDefinition(definition: WorkUnitDefinition): Promise<void> {
  const db = await getDB();
  await db.add('workUnitDefinitions', definition);
}

export async function addWorkUnitDefinitions(definitions: WorkUnitDefinition[]): Promise<void> {
  if (definitions.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('workUnitDefinitions', 'readwrite');
  for (const definition of definitions) {
    await tx.store.put(definition);
  }
  await tx.done;
}

export async function getWorkUnitDefinition(id: string): Promise<WorkUnitDefinition | null> {
  const db = await getDB();
  const definition = await db.get('workUnitDefinitions', id);
  return definition ?? null;
}

export async function getAllWorkUnitDefinitions(): Promise<WorkUnitDefinition[]> {
  const db = await getDB();
  return db.getAll('workUnitDefinitions');
}

export async function updateWorkUnitDefinition(definition: WorkUnitDefinition): Promise<void> {
  const db = await getDB();
  await db.put('workUnitDefinitions', definition);
}

export async function updateWorkUnitDefinitions(definitions: WorkUnitDefinition[]): Promise<void> {
  if (definitions.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('workUnitDefinitions', 'readwrite');
  for (const definition of definitions) {
    await tx.store.put(definition);
  }
  await tx.done;
}

export async function deleteWorkUnitDefinition(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('workUnitDefinitions', id);
}

export async function deleteAllWorkUnitDefinitions(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('workUnitDefinitions', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

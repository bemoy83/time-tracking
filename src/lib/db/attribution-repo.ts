import type { AttributionSnapshot } from '../types';
import { getDB } from './core';

/**
 * Get an attribution snapshot by policy (used as key).
 */
export async function getAttributionSnapshot(policy: string): Promise<AttributionSnapshot | null> {
  const db = await getDB();
  const snapshot = await db.get('attributionSnapshots', policy);
  return snapshot ?? null;
}

/**
 * Save an attribution snapshot (upsert by policy key).
 */
export async function setAttributionSnapshot(snapshot: AttributionSnapshot): Promise<void> {
  const db = await getDB();
  await db.put('attributionSnapshots', snapshot);
}

/**
 * Clear all attribution snapshots.
 * No-ops if the store does not exist (e.g. DB at older schema before migration).
 */
export async function clearAttributionSnapshots(): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('attributionSnapshots')) {
    return;
  }
  const tx = db.transaction('attributionSnapshots', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

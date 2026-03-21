/**
 * Repository for the GlobalTagSequence singleton record.
 * Stored in the `globalTagSequence` IDB object store under key `'global'`.
 */

import { getDB } from './core';
import type { GlobalTagSequence } from '../tags';

export async function getGlobalTagSequence(): Promise<GlobalTagSequence | undefined> {
  const db = await getDB();
  return db.get('globalTagSequence', 'global');
}

export async function putGlobalTagSequence(seq: GlobalTagSequence): Promise<void> {
  const db = await getDB();
  await db.put('globalTagSequence', seq);
}

export async function deleteGlobalTagSequence(): Promise<void> {
  const db = await getDB();
  await db.delete('globalTagSequence', 'global');
}

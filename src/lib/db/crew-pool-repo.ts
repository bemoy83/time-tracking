/**
 * Repository for the CrewPool singleton record.
 * Stored in the `crewPool` IDB object store under key `'global'`.
 */

import { getDB } from './core';
import type { CrewPool } from '../tags';

export async function getCrewPool(): Promise<CrewPool | undefined> {
  const db = await getDB();
  return db.get('crewPool', 'global');
}

export async function putCrewPool(pool: CrewPool): Promise<void> {
  const db = await getDB();
  await db.put('crewPool', pool);
}

export async function deleteCrewPool(): Promise<void> {
  const db = await getDB();
  await db.delete('crewPool', 'global');
}

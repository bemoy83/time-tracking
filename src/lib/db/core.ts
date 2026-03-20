/**
 * IndexedDB setup using idb library.
 * Provides typed database access for offline-first persistence.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { applyDbMigrations } from './migrations/apply-db-migrations';
import type { TimeTrackingDBSchema } from './schema';

export type { TimeTrackingDBSchema } from './schema';

const DB_NAME = 'time-tracking-db';
const DB_VERSION = 36;

let dbPromise: Promise<IDBPDatabase<TimeTrackingDBSchema>> | null = null;

/**
 * Initialize and return the database instance.
 * Creates stores and indexes on first run.
 */
export function getDB(): Promise<IDBPDatabase<TimeTrackingDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TimeTrackingDBSchema>(DB_NAME, DB_VERSION, {
      upgrade: applyDbMigrations,
    });
  }
  return dbPromise;
}

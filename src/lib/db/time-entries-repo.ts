import type { TimeEntry } from '../types';
import { getDB } from './core';

/**
 * Add a completed time entry.
 */
export async function addTimeEntry(entry: TimeEntry): Promise<void> {
  const db = await getDB();
  await db.add('timeEntries', entry);
}

/**
 * Get all time entries for a specific task.
 */
export async function getTimeEntriesByTask(taskId: string): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('timeEntries', 'by-task', taskId);
}

/**
 * Get all time entries with a specific sync status.
 */
export async function getTimeEntriesBySyncStatus(status: string): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('timeEntries', 'by-sync-status', status);
}

/**
 * Get all pending (unsynced) time entries.
 */
export async function getPendingTimeEntries(): Promise<TimeEntry[]> {
  return getTimeEntriesBySyncStatus('pending');
}

/**
 * Update a time entry's sync status.
 */
export async function updateTimeEntrySyncStatus(
  id: string,
  syncStatus: TimeEntry['syncStatus']
): Promise<void> {
  const db = await getDB();
  const entry = await db.get('timeEntries', id);
  if (entry) {
    await db.put('timeEntries', { ...entry, syncStatus });
  }
}

/**
 * Get all time entries.
 */
export async function getAllTimeEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAll('timeEntries');
}

/**
 * Get a single time entry by ID.
 */
export async function getTimeEntry(id: string): Promise<TimeEntry | null> {
  const db = await getDB();
  const entry = await db.get('timeEntries', id);
  return entry ?? null;
}

/**
 * Update a time entry (full replace).
 */
export async function updateTimeEntry(entry: TimeEntry): Promise<void> {
  const db = await getDB();
  await db.put('timeEntries', entry);
}

/**
 * Delete a single time entry by ID.
 */
export async function deleteTimeEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('timeEntries', id);
}

/**
 * Delete all time entries for a specific task.
 * Uses a transaction for atomicity (all or nothing).
 */
export async function deleteTimeEntriesByTask(taskId: string): Promise<void> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('timeEntries', 'by-task', taskId);

  if (entries.length === 0) return;

  const tx = db.transaction('timeEntries', 'readwrite');
  await Promise.all([
    ...entries.map((entry) => tx.store.delete(entry.id)),
    tx.done,
  ]);
}

/**
 * Delete all time entries.
 */
export async function deleteAllTimeEntries(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('timeEntries', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

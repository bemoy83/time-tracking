/**
 * Manual time entry CRUD actions.
 * Separate from timer-store to keep concerns focused.
 */

import {
  addTimeEntry,
  getTimeEntry,
  updateTimeEntry as dbUpdateTimeEntry,
  deleteTimeEntry as dbDeleteTimeEntry,
} from '../db';
import { TimeEntry, generateId, nowUtc } from '../types';
import { notifyListeners } from './timer-store';

/**
 * Add a manual time entry (logged after the fact).
 * Fabricates timestamps: endUtc = now, startUtc = now - durationMs.
 */
export async function addManualEntry(
  taskId: string,
  entryDurationMs: number,
  workers: number
): Promise<TimeEntry> {
  const now = nowUtc();
  const startTime = new Date(Date.now() - entryDurationMs).toISOString();

  const entry: TimeEntry = {
    id: generateId(),
    taskId,
    startUtc: startTime,
    endUtc: now,
    source: 'logged',
    workers: Math.max(1, Math.min(20, Math.round(workers))),
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await addTimeEntry(entry);
  notifyListeners();
  return entry;
}

/**
 * Update an existing time entry's duration and/or workers.
 * Adjusts endUtc when duration changes to maintain consistent timestamps.
 */
export async function updateEntry(
  id: string,
  changes: { durationMs?: number; workers?: number }
): Promise<void> {
  const entry = await getTimeEntry(id);
  if (!entry) return;

  const updated = { ...entry, updatedAt: nowUtc() };

  if (changes.durationMs !== undefined) {
    // Keep startUtc, adjust endUtc to match new duration
    const start = new Date(entry.startUtc).getTime();
    updated.endUtc = new Date(start + changes.durationMs).toISOString();
  }

  if (changes.workers !== undefined) {
    updated.workers = Math.max(1, Math.min(20, Math.round(changes.workers)));
  }

  await dbUpdateTimeEntry(updated);
  notifyListeners();
}

/**
 * Delete a single time entry.
 */
export async function deleteEntry(id: string): Promise<void> {
  await dbDeleteTimeEntry(id);
  notifyListeners();
}

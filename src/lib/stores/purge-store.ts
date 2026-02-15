/**
 * Purge store – destructive data actions.
 * Clear time entries or reset all app data.
 */

import {
  deleteAllTimeEntries,
  deleteAllTasks,
  deleteAllProjects,
  getAllActiveTimers,
  removeActiveTimer,
} from '../db';
import { getPendingCount } from '../sync/sync-queue';
import { setState as setTaskState } from './task-store';

/**
 * Delete all time entries and refresh sync count.
 */
export async function purgeTimeEntries(): Promise<void> {
  await deleteAllTimeEntries();
  await getPendingCount();
}

/**
 * Reset all app data: stop timer, delete entries, tasks, projects.
 * Refreshes task store and sync state afterwards.
 */
export async function resetAllData(): Promise<void> {
  // Stop all active timers
  const timers = await getAllActiveTimers();
  for (const timer of timers) {
    await removeActiveTimer(timer.taskId);
  }
  await deleteAllTimeEntries();
  await deleteAllTasks();
  await deleteAllProjects();

  // Refresh in-memory stores
  setTaskState({ tasks: [], projects: [] });
  await getPendingCount();
}

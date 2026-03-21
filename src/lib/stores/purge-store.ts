/**
 * Purge store – destructive data actions.
 * Clear time entries or reset all app data.
 */

import {
  deleteAllTimeEntries,
  deleteAllTasks,
  deleteAllProjects,
  deleteAllTaskTemplates,
  deleteAllTemplateNotes,
  deleteAllExecutionReturnImports,
  deleteAllPlans,
  deleteAllWorkUnitDefinitions,
  deleteAllWorkTypes,
  deleteAllTags,
  deleteAllTagCategories,
  deleteGlobalTagSequence,
  deleteCrewPool,
  getAllActiveTimers,
  removeActiveTimer,
} from '../db';
import { getPendingCount } from '../sync/sync-queue';
import { setState as setTaskState } from './task-store';
import { resetTemplateState } from './template-store';
import { resetWorkUnitState, reseedBuiltInWorkUnits } from './work-unit-store';
import { resetWorkTypeState } from './work-type-store';
import { resetTagStoreState } from './tag-store';
import { resetCrewPoolStoreState } from './crew-pool-store';
import { invalidateAttributionCache } from '../attribution/cache';

const PLANNING_SESSION_KEY = 'planning-workspace-session';

/**
 * Delete all time entries and refresh sync count.
 */
export async function purgeTimeEntries(): Promise<void> {
  await deleteAllTimeEntries();
  await getPendingCount();
}

/**
 * Reset all app data: stop timer, delete entries, tasks, projects, plans, work types,
 * tags (categories, sequence, crew pool), etc.
 * Refreshes all in-memory stores. Includes workspace plans and field plans alike.
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
  await deleteAllTaskTemplates();
  await deleteAllTemplateNotes();
  await deleteAllExecutionReturnImports();
  await deleteAllPlans();
  await deleteAllWorkTypes();
  await deleteAllTags();
  await deleteAllTagCategories();
  await deleteGlobalTagSequence();
  await deleteCrewPool();
  await deleteAllWorkUnitDefinitions();
  await reseedBuiltInWorkUnits();

  await invalidateAttributionCache();

  setTaskState({ tasks: [], projects: [] });
  resetTemplateState();
  resetWorkUnitState();
  resetWorkTypeState();
  resetTagStoreState();
  resetCrewPoolStoreState();
  try {
    localStorage.removeItem(PLANNING_SESSION_KEY);
  } catch {
    // Ignore
  }
  await getPendingCount();
}

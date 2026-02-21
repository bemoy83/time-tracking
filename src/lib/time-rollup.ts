/**
 * Time rollup helper — computes person-time for a task including its subtasks.
 * One level deep only (matching the current subtask model).
 */

import type { Task, TimeEntry } from './types';
import { getTimeEntriesByTask } from './db';

/**
 * Fetch time entries for a parent task and all its direct children,
 * returning a single combined entry list keyed to the parent task ID.
 */
export async function getEntriesWithSubtaskRollup(
  task: Task,
  allTasks: Task[]
): Promise<TimeEntry[]> {
  const subtasks = allTasks.filter((t) => t.parentId === task.id);
  const taskIds = [task.id, ...subtasks.map((s) => s.id)];

  const allEntries: TimeEntry[] = [];
  for (const id of taskIds) {
    const entries = await getTimeEntriesByTask(id);
    allEntries.push(...entries);
  }

  return allEntries;
}

/**
 * Build an entries-by-task map for qualifying tasks, including subtask rollup.
 * Used by KPI and Calculator to ensure consistent aggregation.
 */
export async function buildRolledUpEntriesMap(
  qualifyingTasks: Task[],
  allTasks: Task[]
): Promise<Map<string, TimeEntry[]>> {
  const entriesByTask = new Map<string, TimeEntry[]>();
  for (const task of qualifyingTasks) {
    const entries = await getEntriesWithSubtaskRollup(task, allTasks);
    entriesByTask.set(task.id, entries);
  }
  return entriesByTask;
}

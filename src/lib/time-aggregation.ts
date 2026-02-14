/**
 * Time aggregation utilities.
 * Calculates time breakdown for tasks including direct and subtask time.
 */

import { getTimeEntriesByTask } from './db';
import { ActiveTimer, TimeEntry, durationMs, elapsedMs } from './types';

/**
 * Time breakdown result for a task.
 */
export interface TimeBreakdown {
  /** Total time in milliseconds (direct + subtasks) */
  totalMs: number;
  /** Direct time on this task in milliseconds */
  directMs: number;
  /** Time on subtasks in milliseconds (one level only) */
  subtaskMs: number;
  /** Number of completed time entries for this task */
  entryCount: number;
  /** Number of completed time entries across subtasks */
  subtaskEntryCount: number;
}

/**
 * Calculate time breakdown for a task.
 *
 * @param taskId - The task to calculate time for
 * @param subtaskIds - IDs of direct subtasks (one level only)
 * @param activeTimer - Current active timer, if any
 * @returns Time breakdown with direct, subtask, and total time
 */
export async function getTaskTimeBreakdown(
  taskId: string,
  subtaskIds: string[],
  activeTimer: ActiveTimer | null
): Promise<TimeBreakdown> {
  // Get completed entries for the main task
  const directEntries = await getTimeEntriesByTask(taskId);
  let directMs = sumEntryDurations(directEntries);
  const entryCount = directEntries.length;

  // Add active timer elapsed if running on this task
  if (activeTimer?.taskId === taskId) {
    directMs += elapsedMs(activeTimer.startUtc);
  }

  // Calculate subtask time
  let subtaskMs = 0;
  let subtaskEntryCount = 0;

  for (const subtaskId of subtaskIds) {
    const subtaskEntries = await getTimeEntriesByTask(subtaskId);
    subtaskMs += sumEntryDurations(subtaskEntries);
    subtaskEntryCount += subtaskEntries.length;

    // Add active timer elapsed if running on this subtask
    if (activeTimer?.taskId === subtaskId) {
      subtaskMs += elapsedMs(activeTimer.startUtc);
    }
  }

  return {
    totalMs: directMs + subtaskMs,
    directMs,
    subtaskMs,
    entryCount,
    subtaskEntryCount,
  };
}

/**
 * Sum durations of completed time entries.
 */
function sumEntryDurations(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => {
    return sum + durationMs(entry.startUtc, entry.endUtc);
  }, 0);
}

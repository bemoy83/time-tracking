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
  /** Total person-ms (duration × workers) across all entries + subtasks */
  totalPersonMs: number;
  /** Person-ms for this task only */
  directPersonMs: number;
  /** Person-ms for subtask entries only */
  subtaskPersonMs: number;
  /** Whether any entry (direct or subtask) has workers > 1 */
  hasMultipleWorkers: boolean;
}

interface EntryTime {
  durationMs: number;
  personMs: number;
}

/**
 * Sum durations and person-ms of completed time entries.
 */
function sumEntryTime(entries: TimeEntry[]): EntryTime {
  let totalDuration = 0;
  let totalPerson = 0;
  for (const entry of entries) {
    const dur = durationMs(entry.startUtc, entry.endUtc);
    const workers = entry.workers ?? 1;
    totalDuration += dur;
    totalPerson += dur * workers;
  }
  return { durationMs: totalDuration, personMs: totalPerson };
}

/**
 * Check if any entry has workers > 1.
 */
function anyMultiWorker(entries: TimeEntry[]): boolean {
  return entries.some((e) => (e.workers ?? 1) > 1);
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
  const direct = sumEntryTime(directEntries);
  let directMs = direct.durationMs;
  let directPersonMs = direct.personMs;
  const entryCount = directEntries.length;
  let hasMultiple = anyMultiWorker(directEntries);

  // Add active timer elapsed if running on this task
  if (activeTimer?.taskId === taskId) {
    const elapsed = elapsedMs(activeTimer.startUtc);
    const workers = activeTimer.workers ?? 1;
    directMs += elapsed;
    directPersonMs += elapsed * workers;
    if (workers > 1) hasMultiple = true;
  }

  // Calculate subtask time
  let subtaskMs = 0;
  let subtaskPersonMs = 0;
  let subtaskEntryCount = 0;

  for (const subtaskId of subtaskIds) {
    const subtaskEntries = await getTimeEntriesByTask(subtaskId);
    const sub = sumEntryTime(subtaskEntries);
    subtaskMs += sub.durationMs;
    subtaskPersonMs += sub.personMs;
    subtaskEntryCount += subtaskEntries.length;
    if (anyMultiWorker(subtaskEntries)) hasMultiple = true;

    // Add active timer elapsed if running on this subtask
    if (activeTimer?.taskId === subtaskId) {
      const elapsed = elapsedMs(activeTimer.startUtc);
      const workers = activeTimer.workers ?? 1;
      subtaskMs += elapsed;
      subtaskPersonMs += elapsed * workers;
      if (workers > 1) hasMultiple = true;
    }
  }

  return {
    totalMs: directMs + subtaskMs,
    directMs,
    subtaskMs,
    entryCount,
    subtaskEntryCount,
    totalPersonMs: directPersonMs + subtaskPersonMs,
    directPersonMs,
    subtaskPersonMs,
    hasMultipleWorkers: hasMultiple,
  };
}

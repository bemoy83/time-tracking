/**
 * Time aggregation utilities.
 * Calculates time breakdown for tasks including direct and subtask time.
 */

import { getTimeEntriesByTask } from './db';
import { ActiveTimer, Task, TimeEntry, durationMs, elapsedMs } from './types';
import { attributeEntries, findMeasurableOwner } from './attribution/engine';

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
 * @param activeTimers - All currently active timers
 * @returns Time breakdown with direct, subtask, and total time
 */
export async function getTaskTimeBreakdown(
  taskId: string,
  subtaskIds: string[],
  activeTimers: ActiveTimer[]
): Promise<TimeBreakdown> {
  // Get completed entries for the main task
  const directEntries = await getTimeEntriesByTask(taskId);
  const direct = sumEntryTime(directEntries);
  let directMs = direct.durationMs;
  let directPersonMs = direct.personMs;
  const entryCount = directEntries.length;
  let hasMultiple = anyMultiWorker(directEntries);

  // Add active timer elapsed if running on this task
  const directTimer = activeTimers.find((t) => t.taskId === taskId);
  if (directTimer) {
    const elapsed = elapsedMs(directTimer.startUtc);
    const workers = directTimer.workers ?? 1;
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
    const subtaskTimer = activeTimers.find((t) => t.taskId === subtaskId);
    if (subtaskTimer) {
      const elapsed = elapsedMs(subtaskTimer.startUtc);
      const workers = subtaskTimer.workers ?? 1;
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

/**
 * Attribution-aware time breakdown for a parent task.
 *
 * Includes only durations attributed to `taskId` and splits contribution by
 * source (direct task entries/timers vs subtask entries/timers).
 */
export async function getTaskTimeBreakdownAttribution(
  taskId: string,
  subtaskIds: string[],
  allTasks: Task[],
  activeTimers: ActiveTimer[],
): Promise<TimeBreakdown> {
  const directEntries = await getTimeEntriesByTask(taskId);
  const subtaskEntriesById = new Map<string, TimeEntry[]>();

  for (const subtaskId of subtaskIds) {
    const entries = await getTimeEntriesByTask(subtaskId);
    subtaskEntriesById.set(subtaskId, entries);
  }

  const allEntries: TimeEntry[] = [
    ...directEntries,
    ...Array.from(subtaskEntriesById.values()).flat(),
  ];

  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const sourceEntryById = new Map(allEntries.map((entry) => [entry.id, entry]));
  const subtaskIdSet = new Set(subtaskIds);
  const { results } = attributeEntries(allEntries, taskMap);

  let directMs = 0;
  let subtaskMs = 0;
  let entryCount = 0;
  let subtaskEntryCount = 0;
  let directPersonMs = 0;
  let subtaskPersonMs = 0;
  let hasMultipleWorkers = false;

  for (const attributedEntry of results) {
    if (attributedEntry.ownerTaskId !== taskId) continue;
    const sourceEntry = sourceEntryById.get(attributedEntry.entryId);
    const workers = sourceEntry?.workers ?? 1;
    const personMs = attributedEntry.personHours * 3_600_000;

    if (attributedEntry.taskId === taskId) {
      directMs += attributedEntry.durationMs;
      directPersonMs += personMs;
      entryCount += 1;
    } else if (subtaskIdSet.has(attributedEntry.taskId)) {
      subtaskMs += attributedEntry.durationMs;
      subtaskPersonMs += personMs;
      subtaskEntryCount += 1;
    }

    if (workers > 1) {
      hasMultipleWorkers = true;
    }
  }

  for (const timer of activeTimers) {
    if (timer.taskId !== taskId && !subtaskIdSet.has(timer.taskId)) continue;

    const task = taskMap.get(timer.taskId);
    if (!task) continue;

    const { ownerTaskId } = findMeasurableOwner(task, allTasks);
    if (ownerTaskId !== taskId) continue;

    const elapsed = elapsedMs(timer.startUtc);
    const workers = timer.workers ?? 1;
    const personMs = elapsed * workers;

    if (timer.taskId === taskId) {
      directMs += elapsed;
      directPersonMs += personMs;
    } else {
      subtaskMs += elapsed;
      subtaskPersonMs += personMs;
    }

    if (workers > 1) {
      hasMultipleWorkers = true;
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
    hasMultipleWorkers,
  };
}

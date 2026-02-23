/**
 * Attribution utilities — pure helpers for summing attributed person-hours
 * and computing active timer contributions via the attribution engine.
 */

import type { Task, ActiveTimer, AttributedEntry } from '../types';
import { elapsedMs } from '../types';
import { findMeasurableOwner } from './engine';

/**
 * Sum person-hours from attributed entries belonging to a specific task.
 */
export function sumAttributedPersonHours(
  entriesByTask: Map<string, AttributedEntry[]>,
  taskId: string,
): number {
  const entries = entriesByTask.get(taskId);
  if (!entries) return 0;
  return entries.reduce((sum, e) => sum + e.personHours, 0);
}

/**
 * Sum clock duration (ms) from attributed entries belonging to a specific task.
 */
export function sumAttributedDurationMs(
  entriesByTask: Map<string, AttributedEntry[]>,
  taskId: string,
): number {
  const entries = entriesByTask.get(taskId);
  if (!entries) return 0;
  return entries.reduce((sum, entry) => sum + entry.durationMs, 0);
}

/**
 * Compute additional person-ms from active timers that attribute to a given task.
 *
 * For each active timer whose taskId is in `timerTaskIds`, runs `findMeasurableOwner`
 * to determine whether the timer's time should be attributed to `taskId`.
 * Returns the total additional person-ms (elapsed × workers) for matching timers.
 */
export function addActiveTimerContribution(
  taskId: string,
  timerTaskIds: string[],
  activeTimers: ActiveTimer[],
  allTasks: Task[],
): number {
  const timerSet = new Set(timerTaskIds);
  let additionalPersonMs = 0;

  for (const timer of activeTimers) {
    if (!timerSet.has(timer.taskId)) continue;

    const task = allTasks.find((t) => t.id === timer.taskId);
    if (!task) continue;

    const { ownerTaskId } = findMeasurableOwner(task, allTasks);
    if (ownerTaskId === taskId) {
      const elapsed = elapsedMs(timer.startUtc);
      additionalPersonMs += elapsed * (timer.workers ?? 1);
    }
  }

  return additionalPersonMs;
}

/**
 * Compute additional duration-ms from active timers that attribute to a given task.
 *
 * Returns elapsed clock time only (no worker multiplication).
 */
export function addActiveTimerDurationContribution(
  taskId: string,
  timerTaskIds: string[],
  activeTimers: ActiveTimer[],
  allTasks: Task[],
): number {
  const timerSet = new Set(timerTaskIds);
  let additionalDurationMs = 0;

  for (const timer of activeTimers) {
    if (!timerSet.has(timer.taskId)) continue;

    const task = allTasks.find((t) => t.id === timer.taskId);
    if (!task) continue;

    const { ownerTaskId } = findMeasurableOwner(task, allTasks);
    if (ownerTaskId === taskId) {
      additionalDurationMs += elapsedMs(timer.startUtc);
    }
  }

  return additionalDurationMs;
}

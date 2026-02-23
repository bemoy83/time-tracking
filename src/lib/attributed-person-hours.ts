/**
 * Attributed person-hours — orchestrates attribution for a single task's
 * TaskDetail view, combining buildAttributedRollup with active timer contribution.
 */

import type { Task, ActiveTimer, AttributionPolicy } from './types';
import { DEFAULT_ATTRIBUTION_POLICY } from './types';
import { buildAttributedRollup } from './attributed-rollup';
import {
  sumAttributedPersonHours,
  sumAttributedDurationMs,
  addActiveTimerContribution,
  addActiveTimerDurationContribution,
} from './attribution/utils';

/**
 * Get the total attributed person-ms for a task.
 *
 * 1. Runs `buildAttributedRollup` for the task (fetches entries, attributes them).
 * 2. Sums person-hours for entries attributed to `taskId`.
 * 3. Adds active timer contribution for timers on the task or its subtasks.
 * 4. Returns total person-ms.
 */
export async function getAttributedPersonHoursForTask(
  taskId: string,
  subtaskIds: string[],
  allTasks: Task[],
  activeTimers: ActiveTimer[],
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<number> {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) return 0;

  // 1. Build attributed rollup for this task
  const { entriesByTask } = await buildAttributedRollup([task], allTasks, policy);

  // 2. Sum person-hours attributed to this task, convert to person-ms
  const personHours = sumAttributedPersonHours(entriesByTask, taskId);
  const personMs = personHours * 3_600_000;

  // 3. Add active timer contribution
  const timerTaskIds = [taskId, ...subtaskIds];
  const timerPersonMs = addActiveTimerContribution(taskId, timerTaskIds, activeTimers, allTasks);

  return personMs + timerPersonMs;
}

/**
 * Get total attributed duration-ms for a task.
 */
export async function getAttributedDurationForTask(
  taskId: string,
  subtaskIds: string[],
  allTasks: Task[],
  activeTimers: ActiveTimer[],
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<number> {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) return 0;

  const { entriesByTask } = await buildAttributedRollup([task], allTasks, policy);
  const attributedDurationMs = sumAttributedDurationMs(entriesByTask, taskId);

  const timerTaskIds = [taskId, ...subtaskIds];
  const timerDurationMs = addActiveTimerDurationContribution(taskId, timerTaskIds, activeTimers, allTasks);

  return attributedDurationMs + timerDurationMs;
}

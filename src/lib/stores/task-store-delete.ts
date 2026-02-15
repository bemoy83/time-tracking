/**
 * Delete operations for the task store.
 * Separated from task-store.ts to keep the main file under 500 lines.
 */

import {
  getTimeEntriesByTask,
  deleteTimeEntriesByTask,
  deleteTaskNotesByTask,
  deleteTask as dbDeleteTask,
  getActiveTimer,
} from '../db';
import { durationMs, elapsedMs } from '../types';
import { stopTimer } from './timer-store';
import { getState, setState } from './task-store';

/**
 * Preview of what will be deleted.
 */
export interface DeletePreview {
  taskIds: string[];
  totalTimeMs: number;
  subtaskCount: number;
  hasActiveTimer: boolean;
}

/**
 * Get a preview of what deleting a task will remove.
 * Includes subtasks (one level) and time totals.
 */
export async function getDeletePreview(taskId: string): Promise<DeletePreview | null> {
  const state = getState();
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const activeTimer = await getActiveTimer();
  const taskIds: string[] = [taskId];
  let subtaskCount = 0;

  if (task.parentId === null) {
    const subtasks = state.tasks.filter((t) => t.parentId === taskId);
    subtaskCount = subtasks.length;
    taskIds.push(...subtasks.map((s) => s.id));
  }

  let totalTimeMs = 0;
  let hasActiveTimer = false;

  for (const id of taskIds) {
    const entries = await getTimeEntriesByTask(id);
    for (const entry of entries) {
      totalTimeMs += durationMs(entry.startUtc, entry.endUtc);
    }
    if (activeTimer?.taskId === id) {
      hasActiveTimer = true;
      totalTimeMs += elapsedMs(activeTimer.startUtc);
    }
  }

  return { taskIds, totalTimeMs, subtaskCount, hasActiveTimer };
}

/**
 * Delete a task and all its time entries.
 * If the task has subtasks, they are also deleted (cascade).
 * If a timer is active on any affected task, it is stopped first.
 */
export async function deleteTaskWithEntries(taskId: string): Promise<void> {
  const preview = await getDeletePreview(taskId);
  if (!preview) return;

  const { taskIds, hasActiveTimer } = preview;

  if (hasActiveTimer) {
    await stopTimer();
  }

  const subtaskIds = taskIds.filter((id) => id !== taskId);

  for (const subtaskId of subtaskIds) {
    await deleteTimeEntriesByTask(subtaskId);
    await deleteTaskNotesByTask(subtaskId);
    await dbDeleteTask(subtaskId);
  }

  await deleteTimeEntriesByTask(taskId);
  await deleteTaskNotesByTask(taskId);
  await dbDeleteTask(taskId);

  setState({
    tasks: getState().tasks.filter((t) => !taskIds.includes(t.id)),
  });
}

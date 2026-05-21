import { Task } from '../types';

interface HasProgressOptions {
  totalMs: number;
  isTimerActive: boolean;
  subtasks?: Task[];
  progress?: { completed: number; total: number } | null;
}

/**
 * True when a task has measurable progress but the timer is not currently running.
 * Drives the "in-progress" blue accent — distinct from recording (red).
 *
 * Triggers:
 * - Time logged on parent or any subtask (totalMs aggregates both)
 * - Any subtask is completed
 * - Any subtask is blocked (work was engaged with, now stuck)
 */
export function hasProgress({ totalMs, isTimerActive, subtasks, progress }: HasProgressOptions): boolean {
  if (isTimerActive) return false;
  if (totalMs > 0) return true;
  if (progress && progress.completed > 0) return true;
  if (subtasks?.some(s => s.status === 'blocked' || s.status === 'completed')) return true;
  return false;
}

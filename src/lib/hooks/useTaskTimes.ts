/**
 * Hook for loading rolled-up time (direct + subtask) for multiple tasks.
 * Used by list views to show time badges without per-task async calls.
 */

import { useState, useEffect } from 'react';
import { getAllTimeEntries } from '../db';
import { Task, ActiveTimer, durationMs, elapsedMs } from '../types';

/**
 * Returns a map of taskId → total rolled-up milliseconds (direct + subtask time).
 * Recomputes when tasks or activeTimers change.
 */
export function useTaskTimes(
  tasks: Task[],
  activeTimers: ActiveTimer[]
): Map<string, number> {
  const [timeMap, setTimeMap] = useState<Map<string, number>>(new Map());

  // Recompute when task list or timers change
  const taskKey = tasks.map((t) => t.id).join(',');
  const timerKey = activeTimers.map((t) => t.id).join(',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await getAllTimeEntries();
      if (cancelled) return;

      // Sum duration per task
      const directMs = new Map<string, number>();
      for (const entry of entries) {
        const dur = durationMs(entry.startUtc, entry.endUtc);
        directMs.set(entry.taskId, (directMs.get(entry.taskId) ?? 0) + dur);
      }

      // Add all active timer elapsed times
      for (const timer of activeTimers) {
        const elapsed = elapsedMs(timer.startUtc);
        directMs.set(
          timer.taskId,
          (directMs.get(timer.taskId) ?? 0) + elapsed
        );
      }

      // Build parent→children map
      const childrenOf = new Map<string, string[]>();
      for (const task of tasks) {
        if (task.parentId) {
          const siblings = childrenOf.get(task.parentId) ?? [];
          siblings.push(task.id);
          childrenOf.set(task.parentId, siblings);
        }
      }

      // Compute rolled-up time: direct + sum of children's direct
      const result = new Map<string, number>();
      for (const task of tasks) {
        let total = directMs.get(task.id) ?? 0;
        const children = childrenOf.get(task.id);
        if (children) {
          for (const childId of children) {
            total += directMs.get(childId) ?? 0;
          }
        }
        if (total > 0) {
          result.set(task.id, total);
        }
      }

      setTimeMap(result);
    }

    load();
    return () => { cancelled = true; };
  }, [taskKey, timerKey]);

  return timeMap;
}

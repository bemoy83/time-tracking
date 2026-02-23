/**
 * Hook for loading rolled-up time (direct + subtask) for multiple tasks.
 * Used by list views to show time badges without per-task async calls.
 */

import { useState, useEffect } from 'react';
import { getAllTimeEntries } from '../db';
import { Task, ActiveTimer, durationMs, elapsedMs } from '../types';
import { attributeEntries, findMeasurableOwner } from '../attribution/engine';
import { useSubtaskTimeRollupMode } from '../stores/subtask-time-rollup-settings';

/**
 * Returns a map of taskId → total rolled-up milliseconds (direct + subtask time).
 * Recomputes when tasks or activeTimers change.
 */
export function useTaskTimes(
  tasks: Task[],
  activeTimers: ActiveTimer[]
): Map<string, number> {
  const subtaskRollupMode = useSubtaskTimeRollupMode();
  const [timeMap, setTimeMap] = useState<Map<string, number>>(new Map());

  // Recompute when task list or timers change
  const taskKey = tasks
    .map((t) => `${t.id}:${t.parentId ?? ''}:${t.workQuantity ?? ''}:${t.workUnit ?? ''}:${t.workTypeId ?? ''}`)
    .join(',');
  const timerKey = activeTimers.map((t) => t.id).join(',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await getAllTimeEntries();
      if (cancelled) return;

      if (subtaskRollupMode === 'attribution') {
        const taskMap = new Map(tasks.map((task) => [task.id, task]));
        const knownTaskIds = new Set(tasks.map((task) => task.id));
        const { results } = attributeEntries(entries, taskMap);
        const result = new Map<string, number>();

        for (const attributedEntry of results) {
          const ownerTaskId = attributedEntry.ownerTaskId;
          if (!ownerTaskId || !knownTaskIds.has(ownerTaskId)) continue;
          result.set(ownerTaskId, (result.get(ownerTaskId) ?? 0) + attributedEntry.durationMs);
        }

        for (const timer of activeTimers) {
          const task = taskMap.get(timer.taskId);
          if (!task) continue;
          const { ownerTaskId } = findMeasurableOwner(task, tasks);
          if (!ownerTaskId || !knownTaskIds.has(ownerTaskId)) continue;
          result.set(ownerTaskId, (result.get(ownerTaskId) ?? 0) + elapsedMs(timer.startUtc));
        }

        setTimeMap(result);
        return;
      }

      // Simple mode: raw rollup (direct + immediate subtasks)
      const directMs = new Map<string, number>();
      for (const entry of entries) {
        const dur = durationMs(entry.startUtc, entry.endUtc);
        directMs.set(entry.taskId, (directMs.get(entry.taskId) ?? 0) + dur);
      }

      for (const timer of activeTimers) {
        const elapsed = elapsedMs(timer.startUtc);
        directMs.set(timer.taskId, (directMs.get(timer.taskId) ?? 0) + elapsed);
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
  }, [taskKey, timerKey, subtaskRollupMode]);

  return timeMap;
}

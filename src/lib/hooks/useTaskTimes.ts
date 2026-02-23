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
 * Returns rolled-up clock and person time for each task.
 * Recomputes when tasks or activeTimers change.
 */
export interface TaskTimes {
  durationByTask: Map<string, number>;
  personMsByTask: Map<string, number>;
}

export function useTaskTimes(
  tasks: Task[],
  activeTimers: ActiveTimer[]
): TaskTimes {
  const subtaskRollupMode = useSubtaskTimeRollupMode();
  const [taskTimes, setTaskTimes] = useState<TaskTimes>({
    durationByTask: new Map(),
    personMsByTask: new Map(),
  });

  // Recompute when task list or timers change
  const taskKey = tasks
    .map((t) => `${t.id}:${t.parentId ?? ''}:${t.workQuantity ?? ''}:${t.workUnit ?? ''}:${t.workTypeId ?? ''}`)
    .join(',');
  const timerKey = activeTimers
    .map((t) => `${t.id}:${t.taskId}:${t.startUtc}:${t.workers}`)
    .join(',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await getAllTimeEntries();
      if (cancelled) return;

      if (subtaskRollupMode === 'attribution') {
        const taskMap = new Map(tasks.map((task) => [task.id, task]));
        const knownTaskIds = new Set(tasks.map((task) => task.id));
        const { results } = attributeEntries(entries, taskMap);
        const durationByTask = new Map<string, number>();
        const personMsByTask = new Map<string, number>();

        for (const attributedEntry of results) {
          const ownerTaskId = attributedEntry.ownerTaskId;
          if (!ownerTaskId || !knownTaskIds.has(ownerTaskId)) continue;
          durationByTask.set(
            ownerTaskId,
            (durationByTask.get(ownerTaskId) ?? 0) + attributedEntry.durationMs
          );
          personMsByTask.set(
            ownerTaskId,
            (personMsByTask.get(ownerTaskId) ?? 0) + attributedEntry.personHours * 3_600_000
          );
        }

        for (const timer of activeTimers) {
          const task = taskMap.get(timer.taskId);
          if (!task) continue;
          const { ownerTaskId } = findMeasurableOwner(task, tasks);
          if (!ownerTaskId || !knownTaskIds.has(ownerTaskId)) continue;
          const elapsed = elapsedMs(timer.startUtc);
          const workers = timer.workers ?? 1;
          durationByTask.set(ownerTaskId, (durationByTask.get(ownerTaskId) ?? 0) + elapsed);
          personMsByTask.set(ownerTaskId, (personMsByTask.get(ownerTaskId) ?? 0) + elapsed * workers);
        }

        setTaskTimes({ durationByTask, personMsByTask });
        return;
      }

      // Simple mode: raw rollup (direct + immediate subtasks)
      const directMs = new Map<string, number>();
      const directPersonMs = new Map<string, number>();
      for (const entry of entries) {
        const dur = durationMs(entry.startUtc, entry.endUtc);
        const workers = entry.workers ?? 1;
        directMs.set(entry.taskId, (directMs.get(entry.taskId) ?? 0) + dur);
        directPersonMs.set(entry.taskId, (directPersonMs.get(entry.taskId) ?? 0) + dur * workers);
      }

      for (const timer of activeTimers) {
        const elapsed = elapsedMs(timer.startUtc);
        const workers = timer.workers ?? 1;
        directMs.set(timer.taskId, (directMs.get(timer.taskId) ?? 0) + elapsed);
        directPersonMs.set(timer.taskId, (directPersonMs.get(timer.taskId) ?? 0) + elapsed * workers);
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
      const durationByTask = new Map<string, number>();
      const personMsByTask = new Map<string, number>();
      for (const task of tasks) {
        let totalDuration = directMs.get(task.id) ?? 0;
        let totalPerson = directPersonMs.get(task.id) ?? 0;
        const children = childrenOf.get(task.id);
        if (children) {
          for (const childId of children) {
            totalDuration += directMs.get(childId) ?? 0;
            totalPerson += directPersonMs.get(childId) ?? 0;
          }
        }
        if (totalDuration > 0) {
          durationByTask.set(task.id, totalDuration);
        }
        if (totalPerson > 0) {
          personMsByTask.set(task.id, totalPerson);
        }
      }

      setTaskTimes({ durationByTask, personMsByTask });
    }

    load();
    return () => { cancelled = true; };
  }, [taskKey, timerKey, subtaskRollupMode]);

  return taskTimes;
}

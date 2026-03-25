/**
 * Hook for fetching attributed person-hours for a task.
 * Refetches when taskId, subtaskIds, or activeTimers change.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, ActiveTimer } from '../types';
import { getAttributedPersonHoursForTask } from '../attributed-person-hours';
import type { SubtaskTimeRollupMode } from '../stores/subtask-time-rollup-settings';
import { getTaskTimeBreakdown } from '../time-aggregation';

/**
 * Fetch and track attributed person-ms for a task.
 *
 * @param taskId - The task to calculate attributed time for
 * @param subtaskIds - IDs of direct subtasks
 * @param allTasks - All tasks (needed for attribution engine)
 * @param activeTimers - All currently active timers (triggers refetch on change)
 * @param refreshKey - Optional key to force refetch from parent
 */
export function useAttributedPersonHours(
  taskId: string,
  subtaskIds: string[],
  allTasks: Task[],
  activeTimers: ActiveTimer[],
  mode: SubtaskTimeRollupMode,
  refreshKey?: number,
): {
  attributedPersonMs: number;
  isLoading: boolean;
  refresh: () => void;
} {
  const [attributedPersonMs, setAttributedPersonMs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const subtaskKey = subtaskIds.join(',');
  const timerKey = activeTimers.map((t) => t.id).join(',');
  const taskKey = allTasks
    .map((t) => `${t.id}:${t.parentId ?? ''}:${t.workQuantity ?? ''}:${t.workUnit ?? ''}:${t.workTypeId ?? ''}`)
    .join(',');

  const fetchAttributed = async () => {
    setIsLoading(true);
    try {
      const result = mode === 'attribution'
        ? await getAttributedPersonHoursForTask(
          taskId,
          subtaskIds,
          allTasks,
          activeTimers,
        )
        : (await getTaskTimeBreakdown(taskId, subtaskIds, activeTimers)).totalPersonMs;
      setAttributedPersonMs(result);
    } catch (err) {
      console.error('Failed to fetch attributed person-hours:', err);
      setAttributedPersonMs(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep ref always pointing at the latest closure so the stable `refresh`
  // callback below always invokes the current fetch without needing to be
  // recreated on every render.
  const fetchRef = useRef(fetchAttributed);
  fetchRef.current = fetchAttributed;

  useEffect(() => {
    fetchAttributed();
  }, [taskId, subtaskKey, taskKey, timerKey, mode, refreshKey]);

  const refresh = useCallback(() => fetchRef.current(), []);

  return { attributedPersonMs, isLoading, refresh };
}

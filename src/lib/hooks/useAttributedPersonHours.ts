/**
 * Hook for fetching attributed person-hours for a task.
 * Refetches when taskId, subtaskIds, or activeTimers change.
 */

import { useState, useEffect } from 'react';
import type { Task, ActiveTimer } from '../types';
import { getAttributedPersonHoursForTask } from '../attributed-person-hours';

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

  const fetchAttributed = async () => {
    setIsLoading(true);
    try {
      const result = await getAttributedPersonHoursForTask(
        taskId,
        subtaskIds,
        allTasks,
        activeTimers,
      );
      setAttributedPersonMs(result);
    } catch (err) {
      console.error('Failed to fetch attributed person-hours:', err);
      setAttributedPersonMs(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributed();
  }, [taskId, subtaskKey, timerKey, refreshKey]);

  const refresh = () => {
    fetchAttributed();
  };

  return { attributedPersonMs, isLoading, refresh };
}

/**
 * Hook for fetching task time breakdown.
 * Refetches when taskId, subtaskIds, or activeTimers change.
 */

import { useState, useEffect } from 'react';
import { ActiveTimer } from '../types';
import { getTaskTimeBreakdown, TimeBreakdown } from '../time-aggregation';

const EMPTY_BREAKDOWN: TimeBreakdown = {
  totalMs: 0,
  directMs: 0,
  subtaskMs: 0,
  entryCount: 0,
  subtaskEntryCount: 0,
  totalPersonMs: 0,
  directPersonMs: 0,
  subtaskPersonMs: 0,
  hasMultipleWorkers: false,
};

/**
 * Fetch and track time breakdown for a task.
 *
 * @param taskId - The task to calculate time for
 * @param subtaskIds - IDs of direct subtasks
 * @param activeTimers - All currently active timers (triggers refetch on change)
 */
export function useTaskTimeBreakdown(
  taskId: string,
  subtaskIds: string[],
  activeTimers: ActiveTimer[]
): {
  breakdown: TimeBreakdown;
  isLoading: boolean;
  refresh: () => void;
} {
  const [breakdown, setBreakdown] = useState<TimeBreakdown>(EMPTY_BREAKDOWN);
  const [isLoading, setIsLoading] = useState(true);

  // Create stable key for subtaskIds to detect changes
  const subtaskKey = subtaskIds.join(',');

  // Track active timer IDs to detect when timers start/stop
  const timerKey = activeTimers.map((t) => t.id).join(',');

  const fetchBreakdown = async () => {
    setIsLoading(true);
    try {
      const result = await getTaskTimeBreakdown(taskId, subtaskIds, activeTimers);
      setBreakdown(result);
    } catch (err) {
      console.error('Failed to fetch time breakdown:', err);
      setBreakdown(EMPTY_BREAKDOWN);
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch when dependencies change
  useEffect(() => {
    fetchBreakdown();
  }, [taskId, subtaskKey, timerKey]);

  // Refresh function for manual updates
  const refresh = () => {
    fetchBreakdown();
  };

  return { breakdown, isLoading, refresh };
}

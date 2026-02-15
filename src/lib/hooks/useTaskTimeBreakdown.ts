/**
 * Hook for fetching task time breakdown.
 * Refetches when taskId, subtaskIds, or activeTimer changes.
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
 * @param activeTimer - Current active timer (triggers refetch on change)
 */
export function useTaskTimeBreakdown(
  taskId: string,
  subtaskIds: string[],
  activeTimer: ActiveTimer | null
): {
  breakdown: TimeBreakdown;
  isLoading: boolean;
  refresh: () => void;
} {
  const [breakdown, setBreakdown] = useState<TimeBreakdown>(EMPTY_BREAKDOWN);
  const [isLoading, setIsLoading] = useState(true);

  // Create stable key for subtaskIds to detect changes
  const subtaskKey = subtaskIds.join(',');

  // Track active timer ID to detect when timer stops
  const activeTimerId = activeTimer?.id ?? null;

  const fetchBreakdown = async () => {
    setIsLoading(true);
    try {
      const result = await getTaskTimeBreakdown(taskId, subtaskIds, activeTimer);
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
  }, [taskId, subtaskKey, activeTimerId]);

  // Refresh function for manual updates
  const refresh = () => {
    fetchBreakdown();
  };

  return { breakdown, isLoading, refresh };
}

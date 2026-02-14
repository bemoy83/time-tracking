/**
 * TaskTimeTracking component.
 * Displays time tracking summary for a task with breakdown.
 *
 * Shows:
 * - Total time (direct + subtasks)
 * - Direct time (on this task)
 * - Subtask time (on direct children, one level only)
 */

import { useTaskTimeBreakdown } from '../lib/hooks/useTaskTimeBreakdown';
import { useTimerStore } from '../lib/stores/timer-store';
import { formatDurationShort } from '../lib/types';

interface TaskTimeTrackingProps {
  taskId: string;
  subtaskIds: string[];
}

export function TaskTimeTracking({ taskId, subtaskIds }: TaskTimeTrackingProps) {
  const { activeTimer } = useTimerStore();
  const { breakdown, isLoading } = useTaskTimeBreakdown(
    taskId,
    subtaskIds,
    activeTimer
  );

  const hasSubtasks = subtaskIds.length > 0;
  const hasTime = breakdown.totalMs > 0;

  // Check if timer is running on this task or any subtask
  const isTimerOnTask = activeTimer?.taskId === taskId;
  const isTimerOnSubtask = subtaskIds.includes(activeTimer?.taskId ?? '');
  const isTimerActive = isTimerOnTask || isTimerOnSubtask;

  return (
    <section className="task-time-tracking" aria-label="Time tracking summary">
      <h2 className="task-time-tracking__title">
        <ClockIcon />
        Time Tracked
        {isTimerActive && (
          <span className="task-time-tracking__live-indicator" aria-label="Timer running">
            Live
          </span>
        )}
      </h2>

      {isLoading ? (
        <div className="task-time-tracking__loading">Loading...</div>
      ) : (
        <div className="task-time-tracking__content">
          {/* Total time - always shown */}
          <div className="task-time-tracking__total">
            <span className="task-time-tracking__label">Total</span>
            <span className="task-time-tracking__value">
              {formatDurationShort(breakdown.totalMs)}
            </span>
          </div>

          {/* Breakdown - shown if there's time or subtasks */}
          {(hasTime || hasSubtasks) && (
            <div className="task-time-tracking__breakdown">
              <div className="task-time-tracking__row">
                <span className="task-time-tracking__row-label">
                  Direct
                  {isTimerOnTask && <LiveDot />}
                </span>
                <span className="task-time-tracking__row-value">
                  {formatDurationShort(breakdown.directMs)}
                </span>
              </div>

              {hasSubtasks && (
                <div className="task-time-tracking__row">
                  <span className="task-time-tracking__row-label">
                    Subtasks ({subtaskIds.length})
                    {isTimerOnSubtask && <LiveDot />}
                  </span>
                  <span className="task-time-tracking__row-value">
                    {formatDurationShort(breakdown.subtaskMs)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Entry count info */}
          {hasTime && (
            <div className="task-time-tracking__entries">
              {breakdown.entryCount + breakdown.subtaskEntryCount} time{' '}
              {breakdown.entryCount + breakdown.subtaskEntryCount === 1
                ? 'entry'
                : 'entries'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="task-time-tracking__icon"
      aria-hidden="true"
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span
      className="task-time-tracking__live-dot"
      aria-label="Timer active"
    />
  );
}

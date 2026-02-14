/**
 * TimerBar component.
 * Sticky bottom bar with timer controls.
 *
 * Design requirements from PLAN.md:
 * - Sticky bottom timer controls
 * - Full-width buttons (thumb-friendly)
 * - 44px+ minimum tap targets
 * - Visual "recording" state visible even when scrolling
 * - One-tap start/stop
 */

import { useState, useEffect } from 'react';
import { useTimerStore, stopTimer } from '../lib/stores/timer-store';
import { getAllTasks } from '../lib/db';
import { Task } from '../lib/types';
import { TimerDisplay } from './TimerDisplay';
import { StopIcon } from './icons';

/**
 * TimerBar - only shown when a timer is active.
 * Sticky bottom bar with timer controls for stopping the current task.
 */
export function TimerBar() {
  const { activeTimer, error } = useTimerStore();
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadTask() {
      if (activeTimer) {
        const tasks = await getAllTasks();
        const task = tasks.find((t) => t.id === activeTimer.taskId);
        setCurrentTask(task || null);
      }
    }
    loadTask();
  }, [activeTimer]);

  const handleStop = async () => {
    setActionError(null);
    setIsLoading(true);
    try {
      const result = await stopTimer();
      if (!result.success) {
        setActionError(result.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="timer-bar timer-bar--active">
      {(error || actionError) && (
        <div className="timer-bar__error" role="alert">
          {error || actionError}
        </div>
      )}

      <div className="timer-bar__task">
        <span className="timer-bar__task-label">Tracking</span>
        <span className="timer-bar__task-name">
          {currentTask?.title || 'No task'}
        </span>
      </div>

      <div className="timer-bar__controls">
        <TimerDisplay size="large" />
        <button
          type="button"
          className="timer-bar__button timer-bar__button--stop"
          onClick={handleStop}
          disabled={isLoading}
          aria-label="Stop timer"
        >
          {isLoading ? (
            <span className="timer-bar__button-loading" aria-hidden="true" />
          ) : (
            <StopIcon className="timer-bar__icon" />
          )}
          <span className="timer-bar__button-text">Stop</span>
        </button>
      </div>
    </div>
  );
}


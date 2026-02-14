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
import { useTimerStore, startTimer, stopTimer } from '../lib/stores/timer-store';
import { getAllTasks, addTask } from '../lib/db';
import { Task, nowUtc } from '../lib/types';
import { TimerDisplay } from './TimerDisplay';
import { PlayIcon, StopIcon } from './icons';

// Default task ID for "Unassigned" placeholder
const UNASSIGNED_TASK_ID = 'unassigned';

/**
 * Ensures a default "Unassigned" task exists.
 * Used when no tasks have been created yet.
 */
async function ensureDefaultTask(): Promise<Task> {
  const tasks = await getAllTasks();

  // Check if unassigned task exists
  let unassigned = tasks.find((t) => t.id === UNASSIGNED_TASK_ID);

  if (!unassigned) {
    const now = nowUtc();
    unassigned = {
      id: UNASSIGNED_TASK_ID,
      title: 'Unassigned',
      status: 'active',
      projectId: null,
      parentId: null,
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await addTask(unassigned);
  }

  return unassigned;
}

export function TimerBar() {
  const { activeTimer, error } = useTimerStore();
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isRunning = !!activeTimer;

  // Load current task on mount and when timer changes
  useEffect(() => {
    async function loadTask() {
      if (activeTimer) {
        // If timer is active, we're tracking that task
        const tasks = await getAllTasks();
        const task = tasks.find((t) => t.id === activeTimer.taskId);
        setCurrentTask(task || null);
      } else {
        // No active timer - show default task
        const defaultTask = await ensureDefaultTask();
        setCurrentTask(defaultTask);
      }
    }
    loadTask();
  }, [activeTimer]);

  const handleStartStop = async () => {
    setActionError(null);
    setIsLoading(true);

    try {
      if (isRunning) {
        // Stop the timer
        const result = await stopTimer();
        if (!result.success) {
          setActionError(result.message);
        }
      } else {
        // Start timer on current task
        if (!currentTask) {
          setActionError('No task selected');
          return;
        }
        const result = await startTimer(currentTask.id);
        if (!result.success) {
          setActionError(result.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`timer-bar ${isRunning ? 'timer-bar--active' : ''}`}>
      {/* Error display */}
      {(error || actionError) && (
        <div className="timer-bar__error" role="alert">
          {error || actionError}
        </div>
      )}

      {/* Task info */}
      <div className="timer-bar__task">
        <span className="timer-bar__task-label">
          {isRunning ? 'Tracking' : 'Ready to track'}
        </span>
        <span className="timer-bar__task-name">
          {currentTask?.title || 'No task'}
        </span>
      </div>

      {/* Timer display and controls */}
      <div className="timer-bar__controls">
        <TimerDisplay size="large" />

        <button
          type="button"
          className={`timer-bar__button ${
            isRunning ? 'timer-bar__button--stop' : 'timer-bar__button--start'
          }`}
          onClick={handleStartStop}
          disabled={isLoading || !currentTask}
          aria-label={isRunning ? 'Stop timer' : 'Start timer'}
        >
          {isLoading ? (
            <span className="timer-bar__button-loading" aria-hidden="true" />
          ) : isRunning ? (
            <StopIcon className="timer-bar__icon" />
          ) : (
            <PlayIcon className="timer-bar__icon" />
          )}
          <span className="timer-bar__button-text">
            {isRunning ? 'Stop' : 'Start'}
          </span>
        </button>
      </div>
    </div>
  );
}


/**
 * TimerBar component.
 * Sticky bottom bar with timer controls.
 * Includes workers badge and inline stepper.
 */

import { useState, useEffect } from 'react';
import { useTimerStore, stopTimer, setTimerWorkers } from '../lib/stores/timer-store';
import { getAllTasks } from '../lib/db';
import { Task } from '../lib/types';
import { TimerDisplay } from './TimerDisplay';
import { WorkersStepper } from './WorkersStepper';
import { StopIcon } from './icons';

export function TimerBar() {
  const { activeTimer, error } = useTimerStore();
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWorkersStepper, setShowWorkersStepper] = useState(false);

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

  const workers = activeTimer?.workers ?? 1;

  return (
    <div className="timer-bar timer-bar--active">
      {(error || actionError) && (
        <div className="timer-bar__error" role="alert">
          {error || actionError}
        </div>
      )}

      <div className="timer-bar__task">
        <span className="timer-bar__task-label">Tracking</span>
        <div className="timer-bar__task-row">
          <span className="timer-bar__task-name">
            {currentTask?.title || 'No task'}
          </span>
          <button
            type="button"
            className={`timer-bar__workers-badge ${workers > 1 ? 'timer-bar__workers-badge--active' : ''}`}
            onClick={() => setShowWorkersStepper(!showWorkersStepper)}
            aria-label={`${workers} workers, tap to adjust`}
          >
            &times;{workers}
          </button>
        </div>
      </div>

      {showWorkersStepper && (
        <div className="timer-bar__workers-stepper">
          <span className="timer-bar__workers-label">Workers</span>
          <WorkersStepper
            value={workers}
            onChange={(n) => setTimerWorkers(n)}
            size="compact"
          />
        </div>
      )}

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

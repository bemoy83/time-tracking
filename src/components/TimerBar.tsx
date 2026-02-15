/**
 * TimerBar component.
 * Sticky bottom bar with timer controls.
 * Supports multiple active timers.
 */

import { useState, useEffect } from 'react';
import { useTimerStore, stopTimer, setTimerWorkers } from '../lib/stores/timer-store';
import { getAllTasks } from '../lib/db';
import { Task, ActiveTimer } from '../lib/types';
import { TimerDisplay } from './TimerDisplay';
import { WorkersStepper } from './WorkersStepper';
import { StopIcon } from './icons';

export function TimerBar() {
  const { activeTimers, error } = useTimerStore();
  const [taskMap, setTaskMap] = useState<Map<string, Task>>(new Map());
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingTimerId, setLoadingTimerId] = useState<string | null>(null);
  const [expandedTimerId, setExpandedTimerId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTasks() {
      if (activeTimers.length > 0) {
        const tasks = await getAllTasks();
        const map = new Map<string, Task>();
        for (const t of tasks) map.set(t.id, t);
        setTaskMap(map);
      }
    }
    loadTasks();
  }, [activeTimers.map((t) => t.taskId).join(',')]);

  const handleStop = async (timer: ActiveTimer) => {
    setActionError(null);
    setLoadingTimerId(timer.id);
    try {
      const result = await stopTimer(timer.taskId);
      if (!result.success) {
        setActionError(result.message);
      }
    } finally {
      setLoadingTimerId(null);
    }
  };

  if (activeTimers.length === 0) return null;

  return (
    <div className="timer-bar timer-bar--active">
      {(error || actionError) && (
        <div className="timer-bar__error" role="alert">
          {error || actionError}
        </div>
      )}

      {activeTimers.map((timer) => {
        const task = taskMap.get(timer.taskId);
        const workers = timer.workers ?? 1;
        const isExpanded = expandedTimerId === timer.id;
        const isLoading = loadingTimerId === timer.id;

        return (
          <div key={timer.id} className="timer-bar__entry">
            <div className="timer-bar__task">
              <span className="timer-bar__task-label">Tracking</span>
              <div className="timer-bar__task-row">
                <span className="timer-bar__task-name">
                  {task?.title || 'No task'}
                </span>
                <button
                  type="button"
                  className={`timer-bar__workers-badge ${workers > 1 ? 'timer-bar__workers-badge--active' : ''}`}
                  onClick={() => setExpandedTimerId(isExpanded ? null : timer.id)}
                  aria-label={`${workers} workers, tap to adjust`}
                >
                  &times;{workers}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="timer-bar__workers-stepper">
                <span className="timer-bar__workers-label">Workers</span>
                <WorkersStepper
                  value={workers}
                  onChange={(n) => setTimerWorkers(timer.taskId, n)}
                  size="compact"
                />
              </div>
            )}

            <div className="timer-bar__controls">
              <TimerDisplay size="large" taskId={timer.taskId} />
              <button
                type="button"
                className="timer-bar__button timer-bar__button--stop"
                onClick={() => handleStop(timer)}
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
      })}
    </div>
  );
}

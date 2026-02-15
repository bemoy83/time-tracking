/**
 * TaskCard component.
 * Card-style task display with swipe actions, progress bar, and subtask expansion.
 * Used in TodayView for the card-based layout.
 */

import { Task, formatDurationShort } from '../lib/types';
import { SwipeableRow } from './SwipeableRow';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import {
  CheckIcon,
  PlayIcon,
  ExpandChevronIcon,
  ClockIcon,
} from './icons';

export interface TaskCardProps {
  task: Task;
  isTimerActive: boolean;
  totalMs?: number;
  taskTimes?: Map<string, number>;
  progress: { completed: number; total: number } | null;
  isExpanded: boolean;
  subtasks: Task[];
  onSelect: () => void;
  onSelectTask: (task: Task) => void;
  onStartTimer: () => void;
  onStartTimerForTask: (task: Task) => void;
  onComplete: () => void;
  onCompleteTask: (task: Task) => void;
  onExpandToggle: () => void;
}

export function TaskCard({
  task,
  isTimerActive,
  totalMs = 0,
  taskTimes,
  progress,
  isExpanded,
  subtasks,
  onSelect,
  onSelectTask,
  onStartTimer,
  onStartTimerForTask,
  onComplete,
  onCompleteTask,
  onExpandToggle,
}: TaskCardProps) {
  const progressPercent = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : null;

  return (
    <>
      <SwipeableRow
        leftAction={{
          label: 'Complete',
          icon: <CheckIcon className="today-view__icon" />,
          color: 'var(--color-ready)',
          onAction: onComplete,
        }}
        rightAction={
          !isTimerActive
            ? {
                label: 'Start',
                icon: <PlayIcon className="today-view__icon" />,
                color: 'var(--color-primary)',
                onAction: onStartTimer,
              }
            : undefined
        }
      >
        <div
          className={`task-card ${isTimerActive ? 'task-card--active' : ''}`}
          onClick={onSelect}
        >
          <div className="task-card__main">
            {/* Timer indicator */}
            {isTimerActive && (
              <span className="task-card__recording-dot" aria-label="Timer running" />
            )}

            {/* Title */}
            <span className="task-card__title">{task.title}</span>

            {/* Time badge */}
            {totalMs > 0 && (
              <span className="task-card__time-badge">
                <ClockIcon className="task-card__time-badge-icon" />
                {formatDurationShort(totalMs)}
              </span>
            )}
          </div>

          {/* Progress bar with expand */}
          {progress && (
            <div className="task-card__progress">
              <div className="task-card__progress-bar">
                <div
                  className="task-card__progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="task-card__progress-text">
                {progress.completed}/{progress.total}
              </span>
              <button
                className={`task-card__expand-btn ${isExpanded ? 'task-card__expand-btn--expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandToggle();
                }}
                aria-expanded={isExpanded}
                aria-controls={`subtasks-${task.id}`}
                aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                <ExpandChevronIcon className="today-view__icon" />
              </button>
            </div>
          )}

        </div>
      </SwipeableRow>

      {/* Expanded subtasks — outside parent SwipeableRow for independent swipe */}
      {isExpanded && subtasks.length > 0 && (
        <div
          id={`subtasks-${task.id}`}
          className="today-view__subtasks"
          role="group"
          aria-label={`Subtasks of ${task.title}`}
        >
          {subtasks.map((subtask) => (
            <SwipeableTaskRow
              key={subtask.id}
              task={subtask}
              isSubtask
              totalMs={taskTimes?.get(subtask.id)}
              onSelect={onSelectTask}
              onStartTimer={onStartTimerForTask}
              onComplete={onCompleteTask}
            />
          ))}
        </div>
      )}
    </>
  );
}

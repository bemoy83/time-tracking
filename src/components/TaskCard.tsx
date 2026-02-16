/**
 * TaskCard component.
 * Card-style task display with swipe actions, progress bar, and subtask expansion.
 * Used in TodayView for the card-based layout.
 */

import { Task, calculateBudgetStatus, formatTrackedVsEstimate } from '../lib/types';
import { SwipeableRow } from './SwipeableRow';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import {
  CheckIcon,
  PlayIcon,
  ExpandChevronIcon,
  ClockIcon,
} from './icons';
import { StatusProgressBar } from './StatusProgressBar';

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
  const budgetStatus = calculateBudgetStatus(totalMs, task.estimatedMinutes);
  const hasBudget = budgetStatus.status !== 'none';

  // Budget bar takes priority over subtask progress bar
  const showBudgetBar = hasBudget;
  const showSubtaskBar = !showBudgetBar && progress !== null;

  const progressPercent = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : null;
  const budgetPercent = Math.min(Math.round(budgetStatus.percentUsed), 100);

  const timeBadgeText = formatTrackedVsEstimate(totalMs, task.estimatedMinutes);

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
            {(totalMs > 0 || hasBudget) && (
              <span
                className={`task-card__time-badge${
                  hasBudget ? ` task-card__time-badge--${budgetStatus.status}` : ''
                }`}
              >
                <ClockIcon className="task-card__time-badge-icon" />
                {timeBadgeText}
              </span>
            )}
          </div>

          {/* Budget progress bar — replaces subtask bar when estimate set */}
          {showBudgetBar && (
            <div className="task-card__progress">
              <StatusProgressBar
                percent={budgetPercent}
                status={budgetStatus.status as 'under' | 'approaching' | 'over'}
                label={`${Math.round(budgetStatus.percentUsed)}%`}
              />
              {progress && (
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
              )}
            </div>
          )}

          {/* Subtask progress bar — only when no estimate */}
          {showSubtaskBar && (
            <div className="task-card__progress">
              <StatusProgressBar
                percent={progressPercent!}
                label={`${progress!.completed}/${progress!.total}`}
              />
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

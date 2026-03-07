/**
 * TaskCard component.
 * Card-style task display with swipe actions, progress bar, and subtask expansion.
 * Used in TodayView for the card-based layout.
 */

import {
  Task,
  calculateBudgetStatusPersonHours,
  formatDurationShort,
  formatTrackedVsEstimatePersonHours,
  getEstimatedPersonMs,
} from '../lib/types';
import type { TaskTimes } from '../lib/hooks/useTaskTimes';
import { SwipeableRow } from './SwipeableRow';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import {
  CheckIcon,
  PlayIcon,
  ExpandChevronIcon,
  ClockIcon,
} from './icons';
import { StatusProgressBar } from './StatusProgressBar';
import { ProjectColorDot } from './ProjectColorDot';

export interface TaskCardProps {
  task: Task;
  projectColor?: string;
  getProjectColor?: (task: Task) => string | undefined;
  isTimerActive: boolean;
  totalMs?: number;
  totalPersonMs?: number;
  taskTimes?: TaskTimes;
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
  projectColor,
  getProjectColor,
  isTimerActive,
  totalMs = 0,
  totalPersonMs = 0,
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
  const estimatedPersonMs = getEstimatedPersonMs(task.estimatedMinutes, task.crew);
  const budgetStatus = calculateBudgetStatusPersonHours(totalPersonMs, estimatedPersonMs);
  const hasBudget = budgetStatus.status !== 'none';

  // Budget bar takes priority over subtask progress bar
  const showBudgetBar = hasBudget;
  const showSubtaskBar = !showBudgetBar && progress !== null;

  const progressPercent = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : null;
  const budgetPercent = Math.min(Math.round(budgetStatus.percentUsed), 100);

  const timeBadgeText = hasBudget
    ? formatTrackedVsEstimatePersonHours(totalPersonMs, estimatedPersonMs)
    : formatDurationShort(totalMs);
  const hasTimeBadge = totalMs > 0 || hasBudget;

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
            {/* Title */}
            {projectColor && <ProjectColorDot color={projectColor} size="sm" className="task-item__project-dot" />}
            <span className="task-card__title">{task.title}</span>

            {(hasTimeBadge || isTimerActive) && (
              <span className="task-card__meta">
                {hasTimeBadge && (
                  <span
                    className={`task-item__time-badge${
                      hasBudget ? ` task-item__time-badge--${budgetStatus.status}` : ''
                    }`}
                  >
                    <ClockIcon className="task-item__time-badge-icon" />
                    {timeBadgeText}
                  </span>
                )}
                {isTimerActive && (
                  <span
                    className="task-item__recording-dot task-item__recording-dot--trailing"
                    aria-label="Timer running"
                  />
                )}
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
                  className={`task-item__expand-btn ${isExpanded ? 'task-item__expand-btn--expanded' : ''}`}
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
                className={`task-item__expand-btn ${isExpanded ? 'task-item__expand-btn--expanded' : ''}`}
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
              projectColor={getProjectColor?.(subtask) ?? projectColor}
              isSubtask
              totalMs={taskTimes?.durationByTask.get(subtask.id)}
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

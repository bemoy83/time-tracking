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
} from './icons';
import { StatusProgressBar } from './StatusProgressBar';
import { TaskProjectDot, TaskTimeBadge, type TaskTimeBadgeStatus } from './TaskItemMeta';
import { hasProgress } from '../lib/utils/taskProgress';

export interface TaskCardProps {
  task: Task;
  resolveProjectColor?: (task: Task) => string | undefined;
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
  resolveProjectColor,
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
  const projectColor = resolveProjectColor?.(task);
  const budgetTimeBadgeStatus = hasBudget
    ? budgetStatus.status as TaskTimeBadgeStatus
    : undefined;

  const isInProgress = hasProgress({ totalMs, isTimerActive, subtasks, progress });

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
          className={`task-card ${isTimerActive ? 'task-card--active' : ''} ${isInProgress ? 'task-card--in-progress' : ''}`}
          onClick={onSelect}
        >
          {projectColor && (
            <TaskProjectDot
              color={projectColor}
              className="task-card__edge-dot task-card__edge-dot--project"
            />
          )}
          <div className="task-card__main">
            {/* Title */}
            <span className="task-card__title">{task.title}</span>

            {hasTimeBadge && (
              <span className="task-card__meta">
                <TaskTimeBadge
                  text={timeBadgeText}
                  status={budgetTimeBadgeStatus}
                />
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

      {/* Subtask drawer — always in DOM when subtasks exist; animates open/closed via CSS grid */}
      {subtasks.length > 0 && (
        <div
          id={`subtasks-${task.id}`}
          className={`today-view__subtasks${isExpanded ? ' today-view__subtasks--open' : ''}`}
          role="group"
          aria-label={`Subtasks of ${task.title}`}
        >
          <div className="today-view__subtasks__inner">
            {subtasks.map((subtask) => (
              <SwipeableTaskRow
                key={subtask.id}
                task={subtask}
                projectColor={resolveProjectColor?.(subtask) ?? projectColor}
                isSubtask
                showProjectDot={false}
                totalMs={taskTimes?.durationByTask.get(subtask.id)}
                onSelect={onSelectTask}
                onStartTimer={onStartTimerForTask}
                onComplete={onCompleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * SwipeableTaskRow component.
 * Composes SwipeableRow around TaskRow to give individual subtasks
 * their own swipe gestures (complete left, start timer right).
 */

import { Task } from '../lib/types';
import { useTimerStore } from '../lib/stores/timer-store';
import { SwipeableRow } from './SwipeableRow';
import { TaskRow } from './TaskRow';
import { PlayIcon, CheckIcon } from './icons';

interface SwipeableTaskRowProps {
  task: Task;
  isSubtask?: boolean;
  subtaskCount?: number;
  totalMs?: number;
  isExpanded?: boolean;
  onExpandToggle?: (e: React.MouseEvent) => void;
  onSelect: (task: Task) => void;
  onStartTimer?: (task: Task) => void;
  onComplete?: (task: Task) => void;
}

export function SwipeableTaskRow({
  task,
  isSubtask,
  subtaskCount,
  totalMs,
  isExpanded,
  onExpandToggle,
  onSelect,
  onStartTimer,
  onComplete,
}: SwipeableTaskRowProps) {
  const { activeTimers } = useTimerStore();
  const isTimerActive = activeTimers.some((t) => t.taskId === task.id);
  const isBlocked = task.status === 'blocked';
  const isCompleted = task.status === 'completed';

  const canComplete = !isCompleted && !isBlocked && onComplete;
  const canStartTimer = !isTimerActive && !isBlocked && !isCompleted && onStartTimer;

  return (
    <SwipeableRow
      leftAction={
        canComplete
          ? {
              label: 'Complete',
              icon: <CheckIcon className="today-view__icon" />,
              color: 'var(--color-ready)',
              onAction: () => onComplete(task),
            }
          : undefined
      }
      rightAction={
        canStartTimer
          ? {
              label: 'Start',
              icon: <PlayIcon className="today-view__icon" />,
              color: 'var(--color-primary)',
              onAction: () => onStartTimer(task),
            }
          : undefined
      }
    >
      <TaskRow
        task={task}
        isSubtask={isSubtask}
        subtaskCount={subtaskCount}
        totalMs={totalMs}
        isExpanded={isExpanded}
        onExpandToggle={onExpandToggle}
        onSelect={onSelect}
      />
    </SwipeableRow>
  );
}

/**
 * TaskRow component.
 * Compact row for task list with status indicators and quick actions.
 *
 * Design requirements from PLAN.md:
 * - Compact rows
 * - High-contrast status indicators
 * - Minimal metadata
 * - Blocked tasks clearly marked
 * - Inline subtask expansion via chevron
 */

import { Task } from '../lib/types';
import { useTimerStore } from '../lib/stores/timer-store';
import {
  PlayIcon,
  PauseIcon,
  CheckIcon,
  BlockedIcon,
  ChevronIcon,
  ExpandChevronIcon,
  CompleteCircleIcon,
} from './icons';

interface TaskRowProps {
  task: Task;
  subtaskCount?: number;
  isExpanded?: boolean;
  onExpandToggle?: (e: React.MouseEvent) => void;
  isSubtask?: boolean;
  onSelect: (task: Task) => void;
  onStartTimer?: (task: Task) => void;
  onStopTimer?: () => void;
  onComplete?: (task: Task) => void;
}

export function TaskRow({
  task,
  subtaskCount = 0,
  isExpanded = false,
  onExpandToggle,
  isSubtask = false,
  onSelect,
  onStartTimer,
  onStopTimer,
  onComplete,
}: TaskRowProps) {
  const { activeTimer } = useTimerStore();
  const isTimerActive = activeTimer?.taskId === task.id;
  const isBlocked = task.status === 'blocked';
  const isCompleted = task.status === 'completed';
  const hasSubtasks = subtaskCount > 0;

  const handleClick = () => {
    onSelect(task);
  };

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBlocked || isCompleted) return;
    if (isTimerActive) {
      onStopTimer?.();
    } else {
      onStartTimer?.(task);
    }
  };

  return (
    <div
      className={`task-row ${isTimerActive ? 'task-row--active' : ''} ${
        isBlocked ? 'task-row--blocked' : ''
      } ${isCompleted ? 'task-row--completed' : ''} ${
        isSubtask ? 'task-row--subtask' : ''
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${task.title}${isBlocked ? ', blocked' : ''}${
        isCompleted ? ', completed' : ''
      }${isTimerActive ? ', timer running' : ''}`}
    >
      {/* Status indicator */}
      <div className="task-row__status" aria-hidden="true">
        {isTimerActive && <span className="task-row__recording-dot" />}
        {isBlocked && <BlockedIcon className="task-row__icon task-row__icon--blocked" />}
        {isCompleted && <CheckIcon className="task-row__icon task-row__icon--check" />}
        {!isTimerActive && !isBlocked && !isCompleted && (
          <span className="task-row__status-dot" />
        )}
      </div>

      {/* Task content */}
      <div className="task-row__content">
        <span className="task-row__title">{task.title}</span>
        {isBlocked && task.blockedReason && (
          <span className="task-row__blocked-reason">
            {task.blockedReason}
          </span>
        )}
        {!isSubtask && subtaskCount > 0 && (
          <span className="task-row__subtask-count">
            {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Complete action */}
      {!isCompleted && !isBlocked && onComplete && (
        <button
          type="button"
          className="task-row__complete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onComplete(task);
          }}
          aria-label="Complete task"
        >
          <CompleteCircleIcon className="task-row__icon" />
        </button>
      )}

      {/* Quick timer action */}
      {!isCompleted && !isBlocked && (
        <button
          type="button"
          className={`task-row__timer-btn ${
            isTimerActive ? 'task-row__timer-btn--active' : ''
          }`}
          onClick={handleTimerClick}
          aria-label={isTimerActive ? 'Stop timer' : 'Start timer'}
        >
          {isTimerActive ? <PauseIcon className="task-row__icon" /> : <PlayIcon className="task-row__icon" />}
        </button>
      )}

      {/* Expand chevron for parents with subtasks, or nav chevron */}
      {!isSubtask && hasSubtasks && onExpandToggle ? (
        <button
          type="button"
          className={`task-row__expand-btn ${isExpanded ? 'task-row__expand-btn--expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onExpandToggle(e);
          }}
          aria-expanded={isExpanded}
          aria-controls={`subtasks-${task.id}`}
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <ExpandChevronIcon className="task-row__expand-icon" />
        </button>
      ) : (
        <ChevronIcon className="task-row__chevron" />
      )}
    </div>
  );
}


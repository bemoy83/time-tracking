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

import { Task, formatDurationShort } from '../lib/types';
import { useTimerStore } from '../lib/stores/timer-store';
import { pluralize } from '../lib/utils/pluralize';
import {
  CheckIcon,
  WarningIcon,
  ChevronIcon,
  ExpandChevronIcon,
} from './icons';
import { TaskProjectDot, TaskRecordingDot, TaskTimeBadge } from './TaskItemMeta';

interface TaskRowProps {
  task: Task;
  projectColor?: string;
  subtaskCount?: number;
  totalMs?: number;
  isExpanded?: boolean;
  onExpandToggle?: (e: React.MouseEvent) => void;
  isSubtask?: boolean;
  onSelect: (task: Task) => void;
}

export function TaskRow({
  task,
  projectColor,
  subtaskCount = 0,
  totalMs = 0,
  isExpanded = false,
  onExpandToggle,
  isSubtask = false,
  onSelect,
}: TaskRowProps) {
  const { activeTimers } = useTimerStore();
  const isTimerActive = activeTimers.some((t) => t.taskId === task.id);
  const isBlocked = task.status === 'blocked';
  const isCompleted = task.status === 'completed';
  const hasSubtasks = subtaskCount > 0;
  const showDefaultStatusDot = !isTimerActive && !isBlocked && !isCompleted;

  const handleClick = () => {
    onSelect(task);
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
        {isCompleted && <CheckIcon className="task-row__icon task-row__icon--check" />}
        {showDefaultStatusDot && (
          <span className="task-row__status-dot" />
        )}
        {!isCompleted && !showDefaultStatusDot && (
          <span className="task-row__status-placeholder" />
        )}
      </div>

      <div className="task-row__project" aria-hidden="true">
        {projectColor ? (
          <TaskProjectDot
            color={projectColor}
            className="task-row__project-dot"
          />
        ) : (
          <span className="task-row__project-placeholder" />
        )}
      </div>

      {/* Task content */}
      <div className="task-row__content">
        <div className="task-row__title-row">
          <span className="task-row__title">{task.title}</span>
          {isBlocked && (
            <span className="task-row__blocked-chip">
              <WarningIcon className="task-row__blocked-chip-icon" />
              Blocked
            </span>
          )}
        </div>
        {isBlocked && task.blockReason && (
          <span className="task-row__blocked-reason">{task.blockReason}</span>
        )}
        {!isSubtask && subtaskCount > 0 && (
          <span className="task-row__subtask-count">
            {pluralize(subtaskCount, 'subtask')}
          </span>
        )}
        {totalMs > 0 && (
          <TaskTimeBadge text={formatDurationShort(totalMs)} />
        )}
      </div>

      <div className="task-row__actions">
        {/* Expand chevron for parents with subtasks, or nav chevron */}
        {!isSubtask && hasSubtasks && onExpandToggle ? (
          <button
            type="button"
            className={`task-item__expand-btn ${isExpanded ? 'task-item__expand-btn--expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onExpandToggle(e);
            }}
            aria-expanded={isExpanded}
            aria-controls={`subtasks-${task.id}`}
            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            <ExpandChevronIcon className="task-item__expand-icon" />
          </button>
        ) : (
          <ChevronIcon className="task-row__chevron" />
        )}
        {isTimerActive && (
          <TaskRecordingDot trailing />
        )}
      </div>
    </div>
  );
}

import { Task, formatDurationShort } from '../lib/types';
import { useTimerStore } from '../lib/stores/timer-store';
import { hasProgress } from '../lib/utils/taskProgress';
import { pluralize } from '../lib/utils/pluralize';
import {
  WarningIcon,
  ChevronIcon,
  ExpandChevronIcon,
  PlayIcon,
  ClockIcon,
  CheckIcon,
} from './icons';
import { TaskTimeBadge } from './TaskItemMeta';

interface TaskRowProps {
  task: Task;
  subtaskCount?: number;
  totalMs?: number;
  isExpanded?: boolean;
  onExpandToggle?: (e: React.MouseEvent) => void;
  isSubtask?: boolean;
  onSelect: (task: Task) => void;
}

export function TaskRow({
  task,
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
  const isInProgress = hasProgress({ totalMs, isTimerActive });

  const handleClick = () => {
    onSelect(task);
  };

  return (
    <div
      className={`task-row ${isTimerActive ? 'task-row--active' : ''} ${
        isBlocked ? 'task-row--blocked' : ''
      } ${isCompleted ? 'task-row--completed' : ''} ${
        isInProgress ? 'task-row--in-progress' : ''
      } ${isSubtask ? 'task-row--subtask' : ''}`}
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
      {/* Status badge column */}
      <div className="task-row__status">
        {isTimerActive && (
          <span
            className="status-badge status-badge--task-icon status-badge--recording"
            aria-label="Timer running"
          >
            <PlayIcon />
          </span>
        )}
        {!isTimerActive && isBlocked && (
          <span
            className="status-badge status-badge--task-icon status-badge--blocked"
            aria-label="Blocked"
          >
            <WarningIcon />
          </span>
        )}
        {!isTimerActive && isCompleted && (
          <span
            className="status-badge status-badge--task-icon status-badge--completed"
            aria-label="Completed"
          >
            <CheckIcon />
          </span>
        )}
        {!isTimerActive && !isBlocked && !isCompleted && isInProgress && (
          <span
            className="status-badge status-badge--task-icon status-badge--in-progress"
            aria-label="In progress"
          >
            <ClockIcon />
          </span>
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
      </div>
    </div>
  );
}

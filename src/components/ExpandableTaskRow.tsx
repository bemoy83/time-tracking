/**
 * ExpandableTaskRow component.
 * Wraps TaskRow for parent tasks, rendering subtask rows inline when expanded.
 * One-level only per PLAN.md §3.3.
 */

import { Task } from '../lib/types';
import { TaskRow } from './TaskRow';

interface ExpandableTaskRowProps {
  task: Task;
  subtasks: Task[];
  isExpanded: boolean;
  onExpandToggle: () => void;
  onSelectTask: (task: Task) => void;
  onStartTimer?: (task: Task) => void;
  onStopTimer?: () => void;
  onComplete?: (task: Task) => void;
}

export function ExpandableTaskRow({
  task,
  subtasks,
  isExpanded,
  onExpandToggle,
  onSelectTask,
  onStartTimer,
  onStopTimer,
  onComplete,
}: ExpandableTaskRowProps) {
  return (
    <div className="expandable-task-row">
      {/* Parent row */}
      <TaskRow
        task={task}
        subtaskCount={subtasks.length}
        isExpanded={isExpanded}
        onExpandToggle={() => onExpandToggle()}
        onSelect={onSelectTask}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
        onComplete={onComplete}
      />

      {/* Subtask rows (expanded) */}
      {isExpanded && subtasks.length > 0 && (
        <div
          id={`subtasks-${task.id}`}
          className="expandable-task-row__subtasks"
          role="group"
          aria-label={`Subtasks of ${task.title}`}
        >
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              isSubtask
              onSelect={onSelectTask}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

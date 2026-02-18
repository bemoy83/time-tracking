/**
 * TaskDetailSubtasks component.
 * Subtask list with ghost "+ Add subtask" button that opens CreateTaskSheet.
 * Uses ExpandableSection flush variant — the card IS the list.
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import { ExpandableSection } from './ExpandableSection';
import { CreateTaskSheet } from './CreateTaskSheet';

interface TaskDetailSubtasksProps {
  task: Task;
  subtasks: Task[];
  taskTimes?: Map<string, number>;
  onSelectTask: (task: Task) => void;
  onStartTimer: (task: Task) => void;
  onCompleteSubtask: (subtask: Task) => void;
}

export function TaskDetailSubtasks({
  task,
  subtasks,
  taskTimes,
  onSelectTask,
  onStartTimer,
  onCompleteSubtask,
}: TaskDetailSubtasksProps) {
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const completedCount = subtasks.filter((t) => t.status === 'completed').length;
  const sectionSummary = subtasks.length > 0 ? `${completedCount}/${subtasks.length} completed` : undefined;

  return (
    <ExpandableSection
      label="Subtasks"
      sectionSummary={sectionSummary}
      defaultOpen={true}
      flush
    >
      {subtasks.map((subtask) => (
        <SwipeableTaskRow
          key={subtask.id}
          task={subtask}
          isSubtask
          totalMs={taskTimes?.get(subtask.id)}
          onSelect={onSelectTask}
          onStartTimer={onStartTimer}
          onComplete={onCompleteSubtask}
        />
      ))}

      <button
        type="button"
        className="create-task-sheet__ghost-btn"
        onClick={() => setShowCreateSheet(true)}
      >
        + Add subtask
      </button>

      <CreateTaskSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        sheetTitle="New Subtask"
        parentId={task.id}
        projectId={task.projectId}
        showWork={false}
        showEstimate={false}
        showWorkers={false}
      />
    </ExpandableSection>
  );
}

/**
 * TaskDetailSubtasks component.
 * Subtask list with add form for TaskDetail page.
 * Uses ExpandableSection flush variant — the card IS the list.
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import { createTask } from '../lib/stores/task-store';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import { ExpandableSection } from './ExpandableSection';
import { InlineCreateForm } from './InlineCreateForm';

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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const completedCount = subtasks.filter((t) => t.status === 'completed').length;
  const sectionSummary = subtasks.length > 0 ? `${completedCount}/${subtasks.length} completed` : undefined;

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await createTask({
      title: newSubtaskTitle.trim(),
      parentId: task.id,
      projectId: task.projectId,
    });
    setNewSubtaskTitle('');
  };

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

      <InlineCreateForm
        className="task-detail__add-subtask-footer"
        placeholder="Add subtask..."
        submitLabel="Add"
        value={newSubtaskTitle}
        onChange={setNewSubtaskTitle}
        onSubmit={handleAddSubtask}
      />
    </ExpandableSection>
  );
}

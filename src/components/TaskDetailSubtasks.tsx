/**
 * TaskDetailSubtasks component.
 * Subtask list with add form for TaskDetail page.
 * Uses ExpandableSection for toggle behavior.
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import { createTask } from '../lib/stores/task-store';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import { ExpandableSection } from './ExpandableSection';

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

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
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
      count={subtasks.length}
      countVariant="muted"
      defaultOpen={true}
    >
      {subtasks.length > 0 && (
        <div className="task-detail__subtask-list">
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
        </div>
      )}

      <form className="task-detail__add-subtask" onSubmit={handleAddSubtask}>
        <input
          type="text"
          placeholder="Add subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          className="input"
        />
        <button
          type="submit"
          className="task-detail__btn task-detail__btn--primary"
          disabled={!newSubtaskTitle.trim()}
        >
          Add
        </button>
      </form>
    </ExpandableSection>
  );
}

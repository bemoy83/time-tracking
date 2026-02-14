/**
 * TaskDetailSubtasks component.
 * Subtask list with add form for TaskDetail page.
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import { createTask } from '../lib/stores/task-store';
import { SwipeableTaskRow } from './SwipeableTaskRow';

interface TaskDetailSubtasksProps {
  task: Task;
  subtasks: Task[];
  onSelectTask: (task: Task) => void;
  onStartTimer: (task: Task) => void;
  onStopTimer: () => void;
  onCompleteSubtask: (subtask: Task) => void;
}

export function TaskDetailSubtasks({
  task,
  subtasks,
  onSelectTask,
  onStartTimer,
  onStopTimer,
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
    <section className="task-detail__subtasks">
      <h2 className="task-detail__section-title">
        Subtasks
        {subtasks.length > 0 && (
          <span className="task-detail__section-count">{subtasks.length}</span>
        )}
      </h2>

      {subtasks.length > 0 && (
        <div className="task-detail__subtask-list">
          {subtasks.map((subtask) => (
            <SwipeableTaskRow
              key={subtask.id}
              task={subtask}
              isSubtask
              onSelect={onSelectTask}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
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
          className="task-detail__input"
        />
        <button
          type="submit"
          className="task-detail__btn task-detail__btn--primary"
          disabled={!newSubtaskTitle.trim()}
        >
          Add
        </button>
      </form>
    </section>
  );
}

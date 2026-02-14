/**
 * TaskList page.
 * Shows all tasks grouped by status, optimized for scanning.
 *
 * Design requirements from PLAN.md:
 * - One-handed scrolling
 * - Fast scanning
 * - Quick timer access
 * - Inline subtask expansion
 */

import { useState } from 'react';
import { Task } from '../lib/types';
import {
  useTaskStore,
  createTask,
} from '../lib/stores/task-store';
import { startTimer, stopTimer, useTimerStore } from '../lib/stores/timer-store';
import { useCompletionFlow } from '../lib/hooks/useCompletionFlow';
import { ExpandableTaskRow } from '../components/ExpandableTaskRow';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';

interface TaskListProps {
  onSelectTask: (task: Task) => void;
}

export function TaskList({ onSelectTask }: TaskListProps) {
  const { tasks, isLoading, error } = useTaskStore();
  const { activeTimer } = useTimerStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const {
    confirmTarget,
    promptParent,
    handleComplete,
    handleConfirmCompleteOnly,
    handleConfirmCompleteAll,
    handlePromptYes,
    dismissConfirm,
    dismissPrompt,
  } = useCompletionFlow(tasks, activeTimer?.taskId);

  // Filter top-level tasks (no parent)
  const topLevelTasks = tasks.filter((t) => t.parentId === null);

  // Group by status
  const activeTasks = topLevelTasks.filter((t) => t.status === 'active');
  const blockedTasks = topLevelTasks.filter((t) => t.status === 'blocked');
  const completedTasks = topLevelTasks.filter((t) => t.status === 'completed');

  // Group subtasks by parent
  const subtasksByParent = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (t.parentId) {
      if (!subtasksByParent.has(t.parentId)) {
        subtasksByParent.set(t.parentId, []);
      }
      subtasksByParent.get(t.parentId)!.push(t);
    }
  });

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsAdding(true);
    try {
      await createTask({ title: newTaskTitle.trim() });
      setNewTaskTitle('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartTimer = async (task: Task) => {
    if (activeTimer) {
      // Stop current timer first
      await stopTimer();
    }
    await startTimer(task.id);
  };

  const handleStopTimer = async () => {
    await stopTimer();
  };

  if (isLoading) {
    return <div className="task-list__loading">Loading tasks...</div>;
  }

  if (error) {
    return <div className="task-list__error">Error: {error}</div>;
  }

  return (
    <div className="task-list">
      {/* Quick add task form */}
      <form className="task-list__add-form" onSubmit={handleAddTask}>
        <input
          type="text"
          className="task-list__add-input"
          placeholder="Add a task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          disabled={isAdding}
        />
        <button
          type="submit"
          className="task-list__add-btn"
          disabled={isAdding || !newTaskTitle.trim()}
        >
          Add
        </button>
      </form>

      {/* Active tasks section */}
      {activeTasks.length > 0 && (
        <section className="task-list__section">
          <h2 className="task-list__section-title">
            Active
            <span className="task-list__section-count">{activeTasks.length}</span>
          </h2>
          <div className="task-list__items">
            {activeTasks.map((task) => (
              <ExpandableTaskRow
                key={task.id}
                task={task}
                subtasks={subtasksByParent.get(task.id) || []}
                isExpanded={expandedTaskIds.has(task.id)}
                onExpandToggle={() => toggleExpanded(task.id)}
                onSelectTask={onSelectTask}
                onStartTimer={handleStartTimer}
                onStopTimer={handleStopTimer}
                onComplete={handleComplete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Blocked tasks section */}
      {blockedTasks.length > 0 && (
        <section className="task-list__section">
          <h2 className="task-list__section-title task-list__section-title--blocked">
            Blocked
            <span className="task-list__section-count">{blockedTasks.length}</span>
          </h2>
          <div className="task-list__items">
            {blockedTasks.map((task) => (
              <ExpandableTaskRow
                key={task.id}
                task={task}
                subtasks={subtasksByParent.get(task.id) || []}
                isExpanded={expandedTaskIds.has(task.id)}
                onExpandToggle={() => toggleExpanded(task.id)}
                onSelectTask={onSelectTask}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed tasks section */}
      {completedTasks.length > 0 && (
        <section className="task-list__section">
          <h2 className="task-list__section-title task-list__section-title--completed">
            Completed
            <span className="task-list__section-count">{completedTasks.length}</span>
          </h2>
          <div className="task-list__items">
            {completedTasks.map((task) => (
              <ExpandableTaskRow
                key={task.id}
                task={task}
                subtasks={subtasksByParent.get(task.id) || []}
                isExpanded={expandedTaskIds.has(task.id)}
                onExpandToggle={() => toggleExpanded(task.id)}
                onSelectTask={onSelectTask}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {topLevelTasks.length === 0 && (
        <div className="task-list__empty">
          <p>No tasks yet.</p>
          <p>Add your first task above to get started.</p>
        </div>
      )}

      {/* Completion dialogs */}
      <CompleteParentConfirm
        isOpen={confirmTarget !== null}
        taskTitle={confirmTarget?.title ?? ''}
        incompleteCount={
          confirmTarget
            ? tasks.filter(
                (t) => t.parentId === confirmTarget.id && t.status !== 'completed'
              ).length
            : 0
        }
        onCompleteOnly={handleConfirmCompleteOnly}
        onCompleteAll={handleConfirmCompleteAll}
        onCancel={dismissConfirm}
      />
      <CompleteParentPrompt
        isOpen={promptParent !== null}
        parentTitle={promptParent?.title ?? ''}
        onYes={handlePromptYes}
        onNo={dismissPrompt}
      />
    </div>
  );
}

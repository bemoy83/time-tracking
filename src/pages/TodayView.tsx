/**
 * TodayView - Primary view for active work.
 *
 * Design requirements from PLAN.md §4.1:
 * - "Today / Active" as primary view
 * - Active timer and current tasks
 * - Project/phase grouping
 * - Progress bars where relevant (color-first)
 * - Swipe actions with long-press fallback
 * - Minimal metadata in list rows
 */

import { useState, useMemo } from 'react';
import { Task, Project } from '../lib/types';
import {
  useTaskStore,
  createTask,
} from '../lib/stores/task-store';
import {
  useTimerStore,
  startTimer,
  stopTimer,
} from '../lib/stores/timer-store';
import { useCompletionFlow } from '../lib/hooks/useCompletionFlow';
import { TimerDisplay } from '../components/TimerDisplay';
import { TaskCard } from '../components/TaskCard';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';
import {
  StopIcon,
  PlusIcon,
  BlockedIcon,
} from '../components/icons';

interface TodayViewProps {
  onSelectTask: (task: Task) => void;
}

export function TodayView({ onSelectTask }: TodayViewProps) {
  const { tasks, projects } = useTaskStore();
  const { activeTimer } = useTimerStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
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

  // Get active task if timer is running
  const activeTask = activeTimer
    ? tasks.find((t) => t.id === activeTimer.taskId)
    : null;

  // Filter and group tasks
  const { groupedTasks, ungroupedTasks, blockedTasks } = useMemo(() => {
    // Get top-level active tasks (not completed, not subtasks)
    const activeTasks = tasks.filter(
      (t) => t.status === 'active' && t.parentId === null
    );
    const blocked = tasks.filter(
      (t) => t.status === 'blocked' && t.parentId === null
    );

    // Group by project
    const byProject = new Map<string | null, Task[]>();
    activeTasks.forEach((task) => {
      const key = task.projectId;
      if (!byProject.has(key)) {
        byProject.set(key, []);
      }
      byProject.get(key)!.push(task);
    });

    // Separate grouped (has project) from ungrouped
    const grouped: { project: Project; tasks: Task[] }[] = [];
    const ungrouped: Task[] = byProject.get(null) || [];

    projects.forEach((project) => {
      const projectTasks = byProject.get(project.id);
      if (projectTasks && projectTasks.length > 0) {
        grouped.push({ project, tasks: projectTasks });
      }
    });

    return {
      groupedTasks: grouped,
      ungroupedTasks: ungrouped,
      blockedTasks: blocked,
    };
  }, [tasks, projects]);

  const handleStartTimer = async (task: Task) => {
    if (activeTimer) {
      await stopTimer();
    }
    await startTimer(task.id);
  };

  const handleStopTimer = async () => {
    await stopTimer();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await createTask({ title: newTaskTitle.trim() });
    setNewTaskTitle('');
  };

  const handleLongPress = (taskId: string) => {
    setShowQuickActions(showQuickActions === taskId ? null : taskId);
  };

  // Count subtasks for progress
  const getSubtaskProgress = (parentId: string) => {
    const subtasks = tasks.filter((t) => t.parentId === parentId);
    if (subtasks.length === 0) return null;
    const completed = subtasks.filter((t) => t.status === 'completed').length;
    return { completed, total: subtasks.length };
  };

  const getSubtasks = (parentId: string) =>
    tasks.filter((t) => t.parentId === parentId);

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

  return (
    <div className="today-view">
      {/* Active Timer Section */}
      {activeTask && (
        <section className="today-view__active-timer">
          <div className="today-view__active-header">
            <span className="today-view__active-label">Now tracking</span>
            <TimerDisplay size="large" />
          </div>
          <div
            className="today-view__active-task"
            onClick={() => onSelectTask(activeTask)}
          >
            <span className="today-view__active-task-title">
              {activeTask.title}
            </span>
            <button
              className="today-view__stop-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStopTimer();
              }}
            >
              <StopIcon className="today-view__icon" />
              Stop
            </button>
          </div>
        </section>
      )}

      {/* Quick Add */}
      <form className="today-view__quick-add" onSubmit={handleAddTask}>
        <input
          type="text"
          placeholder="Quick add task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="today-view__quick-add-input"
        />
        <button
          type="submit"
          className="today-view__quick-add-btn"
          disabled={!newTaskTitle.trim()}
        >
          <PlusIcon className="today-view__icon" />
        </button>
      </form>

      {/* Ungrouped Tasks */}
      {ungroupedTasks.length > 0 && (
        <section className="today-view__section">
          <h2 className="today-view__section-title">Tasks</h2>
          <div className="today-view__task-list">
            {ungroupedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isTimerActive={activeTimer?.taskId === task.id}
                progress={getSubtaskProgress(task.id)}
                showQuickActions={showQuickActions === task.id}
                isExpanded={expandedTaskIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSelect={() => onSelectTask(task)}
                onSelectTask={onSelectTask}
                onStartTimer={() => handleStartTimer(task)}
                onStartTimerForTask={handleStartTimer}
                onStopTimer={handleStopTimer}
                onComplete={() => handleComplete(task)}
                onCompleteTask={handleComplete}
                onLongPress={() => handleLongPress(task.id)}
                onExpandToggle={() => toggleExpanded(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Grouped by Project */}
      {groupedTasks.map(({ project, tasks: projectTasks }) => (
        <section key={project.id} className="today-view__section">
          <h2 className="today-view__section-title">
            <span
              className="today-view__project-dot"
              style={{ backgroundColor: project.color }}
            />
            <span className="today-view__project-badge" style={{ backgroundColor: project.color, color: 'white' }}>
              {project.name}
            </span>
            <span className="today-view__section-count">
              {projectTasks.length}
            </span>
          </h2>
          <div className="today-view__task-list">
            {projectTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isTimerActive={activeTimer?.taskId === task.id}
                progress={getSubtaskProgress(task.id)}
                showQuickActions={showQuickActions === task.id}
                isExpanded={expandedTaskIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSelect={() => onSelectTask(task)}
                onSelectTask={onSelectTask}
                onStartTimer={() => handleStartTimer(task)}
                onStartTimerForTask={handleStartTimer}
                onStopTimer={handleStopTimer}
                onComplete={() => handleComplete(task)}
                onCompleteTask={handleComplete}
                onLongPress={() => handleLongPress(task.id)}
                onExpandToggle={() => toggleExpanded(task.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Blocked Tasks */}
      {blockedTasks.length > 0 && (
        <section className="today-view__section today-view__section--blocked">
          <h2 className="today-view__section-title today-view__section-title--blocked">
            <BlockedIcon className="today-view__icon" />
            Blocked
            <span className="today-view__section-count">{blockedTasks.length}</span>
          </h2>
          <div className="today-view__task-list">
            {blockedTasks.map((task) => (
              <div
                key={task.id}
                className="today-view__blocked-task"
                onClick={() => onSelectTask(task)}
              >
                <span className="today-view__blocked-task-title">
                  {task.title}
                </span>
                <span className="today-view__blocked-reason">
                  {task.blockedReason}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {ungroupedTasks.length === 0 &&
        groupedTasks.length === 0 &&
        blockedTasks.length === 0 && (
          <div className="today-view__empty">
            <p>No active tasks.</p>
            <p>Add a task above to get started.</p>
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



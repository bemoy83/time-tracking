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
} from '../lib/stores/task-store';
import {
  useTimerStore,
  startTimer,
  stopTimer,
} from '../lib/stores/timer-store';
import { useCompletionFlow } from '../lib/hooks/useCompletionFlow';
import { useTaskTimes } from '../lib/hooks/useTaskTimes';
import { TaskCard } from '../components/TaskCard';
import { CountBadge } from '../components/CountBadge';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';
import { SwipeableTaskRow } from '../components/SwipeableTaskRow';
import { BlockedIcon } from '../components/icons';
import { ProjectColorDot } from '../components/ProjectColorDot';
import { CreateTaskSheet } from '../components/CreateTaskSheet';

interface TodayViewProps {
  onSelectTask: (task: Task) => void;
}

export function TodayView({ onSelectTask }: TodayViewProps) {
  const { tasks, projects, isLoading, error } = useTaskStore();
  const { activeTimers } = useTimerStore();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const taskTimes = useTaskTimes(tasks, activeTimers);
  const activeTimerTaskIds = new Set(activeTimers.map((t) => t.taskId));
  const {
    confirmTarget,
    promptParent,
    handleComplete,
    handleConfirmCompleteAll,
    handlePromptYes,
    dismissConfirm,
    dismissPrompt,
    handlePromptCancel,
  } = useCompletionFlow(tasks, activeTimerTaskIds);

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
    // In sequential mode, stop the existing timer before starting a new one
    if (activeTimers.length > 0) {
      for (const timer of activeTimers) {
        await stopTimer(timer.taskId);
      }
    }
    await startTimer(task.id);
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

  if (error) return <div className="today-view__error">Error: {error}</div>;
  if (isLoading) return <div className="today-view__loading">Loading tasks...</div>;

  return (
    <div className="today-view">
      {/* FAB + Create Sheet */}
      <button className="fab" onClick={() => setShowCreateSheet(true)} aria-label="New task">+</button>
      <CreateTaskSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
      />

      {/* Ungrouped Tasks */}
      {ungroupedTasks.length > 0 && (
        <section className="today-view__section">
          <h2 className="today-view__section-title section-heading">Tasks</h2>
          <div className="today-view__task-list">
            {ungroupedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isTimerActive={activeTimerTaskIds.has(task.id)}
                totalMs={taskTimes.get(task.id)}
                taskTimes={taskTimes}
                progress={getSubtaskProgress(task.id)}

                isExpanded={expandedTaskIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSelect={() => onSelectTask(task)}
                onSelectTask={onSelectTask}
                onStartTimer={() => handleStartTimer(task)}
                onStartTimerForTask={handleStartTimer}

                onComplete={() => handleComplete(task)}
                onCompleteTask={handleComplete}

                onExpandToggle={() => toggleExpanded(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Grouped by Project */}
      {groupedTasks.map(({ project, tasks: projectTasks }) => (
        <section key={project.id} className="today-view__section">
          <h2 className="today-view__section-title section-heading">
            <ProjectColorDot color={project.color} />
            <span className="today-view__project-badge" style={{ backgroundColor: project.color, color: 'white' }}>
              {project.name}
            </span>
            <CountBadge count={projectTasks.length} variant="muted" />
          </h2>
          <div className="today-view__task-list">
            {projectTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isTimerActive={activeTimerTaskIds.has(task.id)}
                totalMs={taskTimes.get(task.id)}
                taskTimes={taskTimes}
                progress={getSubtaskProgress(task.id)}

                isExpanded={expandedTaskIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSelect={() => onSelectTask(task)}
                onSelectTask={onSelectTask}
                onStartTimer={() => handleStartTimer(task)}
                onStartTimerForTask={handleStartTimer}

                onComplete={() => handleComplete(task)}
                onCompleteTask={handleComplete}

                onExpandToggle={() => toggleExpanded(task.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Blocked Tasks */}
      {blockedTasks.length > 0 && (
        <section className="today-view__section today-view__section--blocked">
          <h2 className="today-view__section-title section-heading section-heading--blocked">
            <BlockedIcon className="today-view__icon" />
            Blocked
            <CountBadge count={blockedTasks.length} variant="muted" />
          </h2>
          <div className="today-view__task-list">
            {blockedTasks.map((task) => (
              <SwipeableTaskRow
                key={task.id}
                task={task}
                totalMs={taskTimes.get(task.id)}
                onSelect={onSelectTask}
                onComplete={() => handleComplete(task)}
              />
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
        onCompleteAll={handleConfirmCompleteAll}
        onCancel={dismissConfirm}
      />
      <CompleteParentPrompt
        isOpen={promptParent !== null}
        parentTitle={promptParent?.title ?? ''}
        onYes={handlePromptYes}
        onNo={dismissPrompt}
        onCancel={handlePromptCancel}
      />
    </div>
  );
}

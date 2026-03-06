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

import { useState, useMemo, useEffect } from 'react';
import { Task, Project, TaskTemplate } from '../lib/types';
import {
  useTaskStore,
} from '../lib/stores/task-store';
// template-store no longer needed directly — TemplatePickerSheet handles its own data
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
import { WarningIcon, TaskListIcon } from '../components/icons';
import { ProjectColorDot } from '../components/ProjectColorDot';
import { CompletedSection } from '../components/CompletedSection';
import { CreateTaskSheet } from '../components/CreateTaskSheet';
import { TemplatePickerSheet, FROM_PLAN_SENTINEL } from '../components/TemplatePickerSheet';
import { AddFromPlanSheet } from '../components/AddFromPlanSheet';
import { Fab } from '../components/Fab';
import { getFeatureFlag } from '../lib/flags/feature-flags';
import { getContrastColor } from '../lib/utils/contrast';
import { getAllPlans } from '../lib/db';
import type { Plan } from '../lib/planning/plan-model';
import { FieldPlanOverlay } from './field-plan/FieldPlanOverlay';

interface TodayViewProps {
  onSelectTask: (task: Task) => void;
}

export function TodayView({ onSelectTask }: TodayViewProps) {
  const { tasks, projects, isLoading, error } = useTaskStore();
  const { activeTimers } = useTimerStore();
  const fieldPlanEnabled = getFeatureFlag('fieldPlanExecution');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [showFieldPlan, setShowFieldPlan] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [executorPlans, setExecutorPlans] = useState<Plan[]>([]);
  const taskTimes = useTaskTimes(tasks, activeTimers);
  const { durationByTask, personMsByTask } = taskTimes;
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
  const { groupedTasks, ungroupedTasks, blockedTasks, completedTasks } = useMemo(() => {
    // Get top-level active tasks (not completed, not subtasks)
    const activeTasks = tasks.filter(
      (t) => t.status === 'active' && t.parentId === null
    );
    const blocked = tasks.filter(
      (t) => t.status === 'blocked' && t.parentId === null
    );
    const completed = tasks.filter(
      (t) => t.status === 'completed' && t.parentId === null
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
      completedTasks: completed,
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

  useEffect(() => {
    if (!fieldPlanEnabled) return;
    getAllPlans().then((allPlans) => {
      setExecutorPlans(allPlans.filter((plan) => (
        plan.status === 'received' || plan.status === 'session-closed'
      )));
    });
  }, [fieldPlanEnabled, showFieldPlan]);

  const fieldPlanIndicator =
    executorPlans.length > 0
      ? executorPlans.length === 1
        ? `Plan: ${executorPlans[0].title}`
        : `Plans: ${executorPlans.length}`
      : 'Field Plan';

  if (error) return <div className="today-view__error">Error: {error}</div>;
  if (isLoading) return <div className="loading-spinner"><span className="loading-spinner__ring" />Loading tasks...</div>;

  return (
    <div className="today-view">
      <header className="today-view__header">
        <h1 className="today-view__title">Tasks</h1>
        {fieldPlanEnabled && (
          <button
            type="button"
            className="today-view__plan-indicator"
            onClick={() => setShowFieldPlan(true)}
          >
            {fieldPlanIndicator}
          </button>
        )}
      </header>

      {fieldPlanEnabled && (
        <FieldPlanOverlay
          isOpen={showFieldPlan}
          onClose={() => setShowFieldPlan(false)}
        />
      )}

      {/* FAB + Create Flow */}
      <Fab onClick={() => setShowTemplatePicker(true)} aria-label="New task" />
      <TemplatePickerSheet
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={(selection) => {
          setShowTemplatePicker(false);
          if (selection === FROM_PLAN_SENTINEL) {
            setShowPlanSheet(true);
          } else {
            setSelectedTemplate(selection);
            setShowCreateSheet(true);
          }
        }}
      />
      <CreateTaskSheet
        isOpen={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setSelectedTemplate(null); }}
        template={selectedTemplate}
      />
      <AddFromPlanSheet
        isOpen={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
      />

      {/* Active — section header when there are active tasks */}
      {(ungroupedTasks.length > 0 || groupedTasks.length > 0) && (
        <section className="today-view__section today-view__section--active">
          <h2 className="today-view__section-title section-heading section-heading--active">
            <TaskListIcon className="today-view__icon" />
            Active
            <CountBadge count={ungroupedTasks.length + groupedTasks.reduce((s, g) => s + g.tasks.length, 0)} variant="muted" />
          </h2>

          {/* Ungrouped tasks — no sub-label */}
          {ungroupedTasks.length > 0 && (
            <div className="today-view__task-list">
              {ungroupedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isTimerActive={activeTimerTaskIds.has(task.id)}
                  totalMs={durationByTask.get(task.id)}
                  totalPersonMs={personMsByTask.get(task.id)}
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
          )}

          {/* Grouped by project */}
          {groupedTasks.map(({ project, tasks: projectTasks }) => (
            <div key={project.id} className="today-view__task-group">
              <h3 className="today-view__subsection-title section-heading">
                <ProjectColorDot color={project.color} />
                <span className="today-view__project-badge" style={{ backgroundColor: project.color, color: getContrastColor(project.color) }}>
                  {project.name}
                </span>
                <CountBadge count={projectTasks.length} variant="muted" />
              </h3>
              <div className="today-view__task-list">
                {projectTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isTimerActive={activeTimerTaskIds.has(task.id)}
                    totalMs={durationByTask.get(task.id)}
                    totalPersonMs={personMsByTask.get(task.id)}
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
            </div>
          ))}
        </section>
      )}

      {/* Blocked Tasks */}
      {blockedTasks.length > 0 && (
        <section className="today-view__section today-view__section--blocked">
          <h2 className="today-view__section-title section-heading section-heading--blocked">
            <WarningIcon className="today-view__icon" />
            Blocked
            <CountBadge count={blockedTasks.length} variant="muted" />
          </h2>
          <div className="today-view__task-list">
            {blockedTasks.map((task) => (
              <SwipeableTaskRow
                key={task.id}
                task={task}
                totalMs={durationByTask.get(task.id)}
                onSelect={onSelectTask}
                onComplete={() => handleComplete(task)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <CompletedSection
          tasks={completedTasks}
          getTotalMs={(t) => durationByTask.get(t.id)}
          onSelectTask={onSelectTask}
          sectionClassName="today-view__section today-view__section--completed section--completed"
          contentId="today-view__completed-list"
        />
      )}

      {/* Empty State */}
      {ungroupedTasks.length === 0 &&
        groupedTasks.length === 0 &&
        blockedTasks.length === 0 && (
          <div className="empty-state">
            <TaskListIcon className="empty-state__icon" />
            <p className="empty-state__heading">No active tasks</p>
            <p className="empty-state__text">Tap + to add a task and get started.</p>
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

/**
 * ProjectDetail page.
 * Shows project info with breadcrumb nav, metric cards, TaskCard-based task lists,
 * CountBadge section headings, and FAB + sheet create flow.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Task,
  TaskTemplate,
  formatQuantityWithUnit,
  formatDurationShort,
  getProjectDisplayColor,
} from '../lib/types';
import { TrashIcon, WarningIcon, CheckIcon, ClockIcon, PeopleIcon, TaskListIcon } from '../components/icons';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import { resolveEffectiveTagIds } from '../lib/tags';
import { TagFilterPanel } from '../components/TagFilterPanel';
import { useTagFilter } from '../components/useTagFilter';
import { Fab } from '../components/Fab';
import { ProjectColorPicker } from '../components/ProjectColorPicker';
import { ProjectColorDot } from '../components/ProjectColorDot';
import { BreadcrumbNav } from '../components/BreadcrumbNav';
import { EditableTitle } from '../components/EditableTitle';
import { CountBadge } from '../components/CountBadge';
import { MetricCard } from '../components/MetricCard';
import { CompletedSection } from '../components/CompletedSection';
import { TaskCard } from '../components/TaskCard';
import { SwipeableTaskRow } from '../components/SwipeableTaskRow';
import { ActionSheet } from '../components/ActionSheet';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';
import {
  useTaskStore,
  useProjectTasks,
  updateProjectName,
  updateProjectColor,
  getDeleteProjectPreview,
  deleteProjectWithMode,
  DeleteProjectPreview,
} from '../lib/stores/task-store';
import { useTemplateStore } from '../lib/stores/template-store';
import {
  useTimerStore,
  switchToTimer,
} from '../lib/stores/timer-store';
import { useCompletionFlow } from '../lib/hooks/useCompletionFlow';
import { useTaskTimes } from '../lib/hooks/useTaskTimes';
import { useProjectMetrics } from '../lib/hooks/useProjectMetrics';
import { DeleteProjectConfirm } from '../components/DeleteProjectConfirm';
import { CreateTaskSheet } from '../components/CreateTaskSheet';
import { TemplatePickerSheet, FROM_PLAN_SENTINEL } from '../components/TemplatePickerSheet';
import { getAllPlans } from '../lib/db';
import type { Plan } from '../lib/planning/plan-model';
import { isPlanWrapUpEligible } from '../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from '../pages/planning/hooks/usePlanIdsWithImportedExecutionReturns';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from '../lib/hooks/useMediaQuery';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onSelectTask: (task: Task) => void;
  onOpenPlanReview: (planId: string) => void;
}

export function ProjectDetail({
  projectId,
  onBack,
  onSelectTask,
  onOpenPlanReview,
}: ProjectDetailProps) {
  const { projects, tasks } = useTaskStore();
  const { templates } = useTemplateStore();
  const isWideScreen = useMediaQuery(WORKSPACE_MIN_WIDTH);
  const { activeTimers } = useTimerStore();
  const { workTypes } = useWorkTypeStore();
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useProjectTasks(projectId);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [showColorSheet, setShowColorSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeleteProjectPreview | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [plans, setPlans] = useState<Plan[]>([]);

  // Timer & completion hooks
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

  // Project metrics
  const metrics = useProjectMetrics(projectTasks, taskTimes);
  const hasBudgetSummary = metrics.budgetOverCount > 0 || metrics.budgetApproachingCount > 0;
  const budgetSummaryParts: string[] = [];
  if (metrics.budgetOverCount > 0) budgetSummaryParts.push(`${metrics.budgetOverCount} over`);
  if (metrics.budgetApproachingCount > 0) budgetSummaryParts.push(`${metrics.budgetApproachingCount} approaching`);
  if (metrics.budgetUnderCount > 0) budgetSummaryParts.push(`${metrics.budgetUnderCount} under`);
  const budgetSummaryText = budgetSummaryParts.join(' • ');
  const workQuantitySummary = Array.from(metrics.workQuantityByUnit.entries())
    .map(([unit, quantity]) => {
      const rounded = Number.isInteger(quantity)
        ? quantity.toString()
        : quantity.toFixed(2).replace(/\.?0+$/, '');
      return formatQuantityWithUnit(rounded, unit);
    })
    .join(', ');

  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();

  useEffect(() => {
    getAllPlans().then(setPlans);
  }, []);

  const reviewReadyPlan = useMemo(() => {
    const candidates = plans.filter((plan) => plan.projectId === projectId && plan.status === 'active');
    const ready = candidates.filter((plan) =>
      isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id)),
    );
    ready.sort((a, b) => (b.activatedAt ?? '').localeCompare(a.activatedAt ?? ''));
    return ready[0] ?? null;
  }, [plans, projectId, tasks, planIdsWithImportedExecutionReturns]);

  if (!project) {
    return (
      <div className="project-detail">
        <BreadcrumbNav onBack={onBack} segments={[]} />
        <p>Project not found.</p>
      </div>
    );
  }

  const workTypeById = useMemo(
    () => new Map(workTypes.map((wt) => [wt.id, wt])),
    [workTypes],
  );

  // Collect effective tag IDs across all project tasks for the filter panel
  const availableTagIds = useMemo(() => {
    const set = new Set<string>();
    for (const task of projectTasks) {
      const wt = task.workTypeId ? workTypeById.get(task.workTypeId) : undefined;
      const effective = resolveEffectiveTagIds(wt?.tagIds ?? [], task.additionalTagIds ?? []);
      effective.forEach((id) => set.add(id));
    }
    return [...set];
  }, [projectTasks, workTypeById]);

  const tagFilter = useTagFilter(availableTagIds, { resetKey: projectId });

  const taskMatchesTagFilters = useCallback((task: Task): boolean => {
    if (tagFilter.activeTagFilters.size === 0) return true;
    const wt = task.workTypeId ? workTypeById.get(task.workTypeId) : undefined;
    const effective = resolveEffectiveTagIds(wt?.tagIds ?? [], task.additionalTagIds ?? []);
    return effective.some((id) => tagFilter.activeTagFilters.has(id));
  }, [tagFilter.activeTagFilters, workTypeById]);

  const allActiveTasks = projectTasks.filter((t) => t.status === 'active');
  const activeTasks = allActiveTasks.filter(taskMatchesTagFilters);
  const completedTasks = projectTasks.filter((t) => t.status === 'completed');
  const blockedTasks = projectTasks.filter((t) => t.status === 'blocked').filter(taskMatchesTagFilters);

  const handleColorChange = async (color: string) => {
    await updateProjectColor(project.id, color);
    setShowColorSheet(false);
  };

  const handleDeleteClick = async () => {
    const preview = await getDeleteProjectPreview(project.id);
    setDeletePreview(preview);
    setShowDeleteConfirm(true);
  };

  const handleDeleteUnassign = async () => {
    await deleteProjectWithMode(project.id, 'unassign');
    setShowDeleteConfirm(false);
    onBack();
  };

  const handleDeleteTasks = async () => {
    await deleteProjectWithMode(project.id, 'delete_tasks');
    setShowDeleteConfirm(false);
    onBack();
  };

  const handleStartTimer = async (task: Task) => {
    await switchToTimer(task.id);
  };

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
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const resolveProjectColor = () => getProjectDisplayColor(project.color);

  return (
    <div className="project-detail">
      {/* Header: breadcrumb + editable name with color dot */}
      <div className="project-detail__title-section">
        <BreadcrumbNav
          onBack={onBack}
          segments={[{ label: 'Projects' }]}
        />
        <div className="project-detail__name-row">
          <button
            className="project-detail__color-toggle"
            onClick={() => setShowColorSheet(true)}
            aria-label="Change project color"
          >
            <ProjectColorDot color={project.color} size="lg" />
          </button>
          <EditableTitle
            value={project.name}
            onSave={(name) => updateProjectName(project.id, name)}
          />
        </div>
      </div>

      {/* Color picker sheet */}
      <ActionSheet
        isOpen={showColorSheet}
        title="Project Color"
        onClose={() => setShowColorSheet(false)}
      >
        <div className="project-detail__color-sheet-content">
          <ProjectColorPicker
            value={project.color}
            onChange={handleColorChange}
          />
        </div>
      </ActionSheet>

      {/* Metric cards */}
      <div className="project-detail__metrics metric-card-grid">
        <MetricCard
          icon={<TaskListIcon />}
          iconVariant="tasks"
          value={metrics.totalTasks}
          label="Tasks"
        />
        <MetricCard
          icon={<CheckIcon />}
          iconVariant="done"
          value={metrics.doneCount}
          label="Done"
        />
        <MetricCard
          icon={<ClockIcon />}
          iconVariant="time"
          value={formatDurationShort(metrics.totalTimeMs)}
          label="Time"
        />
        <MetricCard
          icon={<PeopleIcon />}
          iconVariant="people"
          value={metrics.personHours}
          label="Person-Hrs"
        />
        <MetricCard
          icon={<WarningIcon />}
          iconVariant="blocked"
          value={metrics.blockedCount}
          label="Blocked"
        />
        {metrics.estimatedPersonHours !== null && (
          <MetricCard
            icon={<PeopleIcon />}
            iconVariant="estimate"
            value={metrics.estimatedPersonHours}
            label="Est. Person-Hrs"
            meta={metrics.tasksWithEstimate === 1 ? '1 task with estimate' : `${metrics.tasksWithEstimate} tasks with estimate`}
          />
        )}
      </div>
      {hasBudgetSummary && (
        <p className="project-detail__metrics-note">
          Budget: {budgetSummaryText}
        </p>
      )}
      {workQuantitySummary.length > 0 && (
        <p className="project-detail__metrics-note">
          Work Qty: {workQuantitySummary}
        </p>
      )}
      {reviewReadyPlan && isWideScreen && (
        <div className="project-detail__metrics-note">
          This project has a completed plan.{' '}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => onOpenPlanReview(reviewReadyPlan.id)}
          >
            View review
          </button>
        </div>
      )}

      {/* FAB + Create Flow */}
      <Fab
        onClick={() => {
          if (templates.length > 0) {
            setShowTemplatePicker(true);
          } else {
            setSelectedTemplate(null);
            setShowCreateSheet(true);
          }
        }}
        aria-label="New task"
      />
      <TemplatePickerSheet
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={(selection) => {
          if (selection === FROM_PLAN_SENTINEL) return; // not supported in project context
          setSelectedTemplate(selection);
          setShowTemplatePicker(false);
          setShowCreateSheet(true);
        }}
      />
      <CreateTaskSheet
        isOpen={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setSelectedTemplate(null); }}
        projectId={projectId}
        template={selectedTemplate}
      />

      {/* Tag filter panel — shown when project tasks have tags */}
      {tagFilter.availableCategories.length > 0 && (
        <div className="project-detail__tag-filter-card">
          <TagFilterPanel
            activeTagFilters={tagFilter.activeTagFilters}
            tagSearchQuery={tagFilter.tagSearchQuery}
            selectedCategoryId={tagFilter.selectedCategoryId}
            availableCategories={tagFilter.availableCategories}
            displayedTags={tagFilter.displayedTags}
            hasActiveFilters={tagFilter.hasActiveFilters}
            onToggleTag={tagFilter.toggleTagFilter}
            onSearchChange={tagFilter.setTagSearchQuery}
            onCategoryChange={tagFilter.setSelectedCategoryId}
            onClearFilters={tagFilter.clearTagFilters}
          />
        </div>
      )}

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section className="project-detail__section">
          <h2 className="project-detail__section-title section-heading">
            Active
            <CountBadge count={activeTasks.length} variant="muted" />
          </h2>
          <div className="today-view__task-list">
            {activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                resolveProjectColor={resolveProjectColor}
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
        </section>
      )}

      {/* Blocked tasks */}
      {blockedTasks.length > 0 && (
        <section className="project-detail__section project-detail__section--blocked">
          <h2 className="project-detail__section-title section-heading section-heading--blocked">
            <WarningIcon className="project-detail__section-icon" />
            Blocked
            <CountBadge count={blockedTasks.length} variant="muted" />
          </h2>
          <div className="today-view__task-list">
            {blockedTasks.map((task) => (
              <SwipeableTaskRow
                key={task.id}
                task={task}
                projectColor={getProjectDisplayColor(project.color)}
                totalMs={durationByTask.get(task.id)}
                onSelect={onSelectTask}
                onComplete={() => handleComplete(task)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <CompletedSection
          tasks={completedTasks}
          getTotalMs={(t) => durationByTask.get(t.id)}
          getProjectColor={() => getProjectDisplayColor(project.color)}
          onSelectTask={onSelectTask}
          sectionClassName="project-detail__section project-detail__section--completed section--completed"
          contentId="project-detail__completed-list"
        />
      )}

      {/* Empty state */}
      {projectTasks.length === 0 && (
        <div className="project-detail__empty">
          <p>No tasks in this project yet.</p>
          <p>Tap + to add one.</p>
        </div>
      )}

      {/* Delete project */}
      <button
        className="project-detail__delete-link"
        onClick={handleDeleteClick}
      >
        <TrashIcon className="project-detail__delete-link-icon" />
        Delete Project
      </button>

      {/* Delete confirmation */}
      <DeleteProjectConfirm
        isOpen={showDeleteConfirm}
        projectName={project.name}
        taskCount={deletePreview?.taskCount ?? 0}
        totalTimeMs={deletePreview?.totalTimeMs ?? 0}
        onUnassign={handleDeleteUnassign}
        onDeleteTasks={handleDeleteTasks}
        onCancel={() => setShowDeleteConfirm(false)}
      />

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

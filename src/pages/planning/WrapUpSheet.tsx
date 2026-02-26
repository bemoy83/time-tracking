import { useEffect, useMemo, useState } from 'react';
import { ActionSheet } from '../../components/ActionSheet';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import { durationMs, WORK_UNIT_LABELS } from '../../lib/types';
import { detectOutliers } from '../../lib/kpi';
import { getTimeEntriesByTask } from '../../lib/db';
import { executePlanWrapUp } from '../../lib/planning/wrap-up';
import {
  getPlanLinkedTasks,
  getUnplannedProjectTasks,
  isPlanReviewReady,
} from '../../lib/planning/plan-lifecycle';

interface WrapUpSheetProps {
  isOpen: boolean;
  plan: Plan;
  tasks: Task[];
  onClose: () => void;
  onCompleted: (updatedPlan: Plan) => void;
}

interface TaskGroup {
  id: string;
  title: string;
  tasks: Task[];
}

function toRateLabel(rate: number | null, task: Task): string {
  if (rate == null || task.workUnit == null) return 'No measurable productivity yet';
  const unit = WORK_UNIT_LABELS[task.workUnit] ?? task.workUnit;
  return `${rate.toFixed(1)} ${unit}/person-hr`;
}

function resolveTaskGroups(plan: Plan, projectTasks: Task[]): TaskGroup[] {
  const groupsById = new Map<string, TaskGroup>();

  const getOrCreateGroup = (id: string, title: string): TaskGroup => {
    const existing = groupsById.get(id);
    if (existing) return existing;
    const group = { id, title, tasks: [] };
    groupsById.set(id, group);
    return group;
  };

  for (const task of projectTasks) {
    let groupId = 'unplanned';
    let groupTitle = 'Unplanned Work';

    if (task.sourceLineItemId != null) {
      const matchingLineItem = plan.lineItems.find((item) => item.id === task.sourceLineItemId);
      if (matchingLineItem) {
        groupId = matchingLineItem.id;
        groupTitle = matchingLineItem.title;
      }
    }

    if (groupId === 'unplanned') {
      const matchedByType = plan.lineItems.find(
        (item) =>
          item.workTypeId != null &&
          item.workTypeId === task.workTypeId &&
          item.workUnit === task.workUnit &&
          item.buildPhase === task.buildPhase,
      );
      if (matchedByType) {
        groupId = matchedByType.id;
        groupTitle = matchedByType.title;
      }
    }

    getOrCreateGroup(groupId, groupTitle).tasks.push(task);
  }

  return [...groupsById.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function WrapUpSheet({ isOpen, plan, tasks, onClose, onCompleted }: WrapUpSheetProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [rateByTaskId, setRateByTaskId] = useState<Map<string, number | null>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkedTasks = useMemo(() => getPlanLinkedTasks(plan, tasks), [plan, tasks]);
  const unplannedTasks = useMemo(() => getUnplannedProjectTasks(plan, tasks), [plan, tasks]);
  const projectTasks = useMemo(() => {
    const deduped = new Map<string, Task>();
    for (const task of linkedTasks) deduped.set(task.id, task);
    if (plan.projectId != null) {
      for (const task of unplannedTasks) deduped.set(task.id, task);
    }
    return [...deduped.values()];
  }, [linkedTasks, plan.projectId, unplannedTasks]);
  const reviewReady = useMemo(() => isPlanReviewReady(plan, tasks), [plan, tasks]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTaskIds(new Set(projectTasks.map((task) => task.id)));
    setIsSubmitting(false);
  }, [isOpen, projectTasks]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadRates() {
      const rateMap = new Map<string, number | null>();
      for (const task of projectTasks) {
        const entries = await getTimeEntriesByTask(task.id);
        const personHours = entries.reduce((sum, entry) => {
          const durationHours = durationMs(entry.startUtc, entry.endUtc) / 3_600_000;
          return sum + durationHours * (entry.workers ?? 1);
        }, 0);

        const rate =
          task.workQuantity != null && task.workQuantity > 0 && personHours > 0
            ? task.workQuantity / personHours
            : null;
        rateMap.set(task.id, rate);
      }

      if (!cancelled) {
        setRateByTaskId(rateMap);
      }
    }

    void loadRates();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectTasks]);

  const groups = useMemo(() => resolveTaskGroups(plan, projectTasks), [plan, projectTasks]);

  const outlierTaskIds = useMemo(() => {
    const flagged = new Set<string>();
    for (const group of groups) {
      const ratedTasks = group.tasks
        .map((task) => ({ taskId: task.id, rate: rateByTaskId.get(task.id) ?? null }))
        .filter((entry): entry is { taskId: string; rate: number } => entry.rate != null);

      const outlierIndices = detectOutliers(ratedTasks.map((entry) => entry.rate));
      for (const index of outlierIndices) {
        const entry = ratedTasks[index];
        if (entry) flagged.add(entry.taskId);
      }
    }
    return flagged;
  }, [groups, rateByTaskId]);

  const toggleSelected = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const runWrapUp = async (mode: 'archive-and-complete' | 'save-review-only') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const allProjectTaskIds = projectTasks.map((task) => task.id);
      const selectedIds = new Set(selectedTaskIds);
      const excludeTaskIds = allProjectTaskIds.filter((taskId) => !selectedIds.has(taskId));
      const archiveTaskIds =
        mode === 'archive-and-complete'
          ? allProjectTaskIds
          : allProjectTaskIds.filter((taskId) => selectedIds.has(taskId));

      const updatedPlan = await executePlanWrapUp({
        plan,
        excludeTaskIds,
        archiveTaskIds,
        markReviewed: mode === 'archive-and-complete',
      });

      onCompleted(updatedPlan);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title="Wrap Up Review">
      {projectTasks.length === 0 ? (
        <p className="wrap-up-sheet__empty">No project tasks found for this plan.</p>
      ) : (
        <div className="wrap-up-sheet">
          {groups.map((group) => (
            <section key={group.id} className="wrap-up-sheet__group">
              <h3 className="wrap-up-sheet__group-title">{group.title}</h3>
              <div className="wrap-up-sheet__list">
                {group.tasks.map((task) => {
                  const selected = selectedTaskIds.has(task.id);
                  const rate = rateByTaskId.get(task.id) ?? null;
                  const isOutlier = outlierTaskIds.has(task.id);
                  return (
                    <label key={task.id} className="wrap-up-sheet__row">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(task.id)}
                        disabled={isSubmitting}
                      />
                      <span className="wrap-up-sheet__row-content">
                        <span className="wrap-up-sheet__row-title">
                          {task.title}
                          {isOutlier && <span className="wrap-up-sheet__outlier">Outlier</span>}
                        </span>
                        <span className="wrap-up-sheet__row-meta">{toRateLabel(rate, task)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          {!reviewReady && (
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => runWrapUp('save-review-only')}
              disabled={isSubmitting}
            >
              Save Review Only
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => runWrapUp('archive-and-complete')}
            disabled={isSubmitting || projectTasks.length === 0}
          >
            Archive and Complete
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTimeEntriesByTask } from '../../../lib/db';
import { detectOutliers } from '../../../lib/kpi';
import {
  getPlanLinkedTasks,
  getUnplannedProjectTasks,
  isPlanReviewReady,
} from '../../../lib/planning/plan-lifecycle';
import type { Plan } from '../../../lib/planning/plan-model';
import { executePlanWrapUp } from '../../../lib/planning/wrap-up';
import { durationMs, type Task } from '../../../lib/types';

type WrapUpMode = 'archive-and-complete' | 'save-review-only';

export interface WrapUpTaskGroup {
  id: string;
  title: string;
  tasks: Task[];
}

function resolveTaskGroups(plan: Plan, projectTasks: Task[]): WrapUpTaskGroup[] {
  const groupsById = new Map<string, WrapUpTaskGroup>();

  const getOrCreateGroup = (id: string, title: string): WrapUpTaskGroup => {
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

async function loadTaskRates(projectTasks: Task[]): Promise<Map<string, number | null>> {
  const rates = await Promise.all(projectTasks.map(async (task) => {
    const entries = await getTimeEntriesByTask(task.id);
    const personHours = entries.reduce((sum, entry) => {
      const durationHours = durationMs(entry.startUtc, entry.endUtc) / 3_600_000;
      return sum + durationHours * (entry.workers ?? 1);
    }, 0);

    const rate =
      task.workQuantity != null && task.workQuantity > 0 && personHours > 0
        ? task.workQuantity / personHours
        : null;
    return [task.id, rate] as const;
  }));

  return new Map(rates);
}

function detectOutlierTaskIds(
  groups: WrapUpTaskGroup[],
  rateByTaskId: Map<string, number | null>,
): Set<string> {
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
}

interface UseWrapUpSheetModelParams {
  isOpen: boolean;
  plan: Plan;
  tasks: Task[];
  onClose: () => void;
  onCompleted: (updatedPlan: Plan) => void;
}

export function useWrapUpSheetModel({
  isOpen,
  plan,
  tasks,
  onClose,
  onCompleted,
}: UseWrapUpSheetModelParams) {
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
  const groups = useMemo(() => resolveTaskGroups(plan, projectTasks), [plan, projectTasks]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTaskIds(new Set(projectTasks.map((task) => task.id)));
    setIsSubmitting(false);
  }, [isOpen, projectTasks]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadRates() {
      const rates = await loadTaskRates(projectTasks);
      if (!cancelled) {
        setRateByTaskId(rates);
      }
    }

    void loadRates();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectTasks]);

  const outlierTaskIds = useMemo(
    () => detectOutlierTaskIds(groups, rateByTaskId),
    [groups, rateByTaskId],
  );

  const toggleSelected = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const runWrapUp = useCallback(async (mode: WrapUpMode) => {
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
  }, [isSubmitting, onClose, onCompleted, plan, projectTasks, selectedTaskIds]);

  return {
    selectedTaskIds,
    rateByTaskId,
    isSubmitting,
    reviewReady,
    projectTasks,
    groups,
    outlierTaskIds,
    toggleSelected,
    runWrapUp,
  };
}

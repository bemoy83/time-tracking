import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../../lib/types';
import { executePlanWrapUpV2 } from '../../../lib/planning/wrap-up';
import {
  loadWrapUpV2Projection,
} from '../../../lib/planning/wrap-up-v2-projection';
import type {
  TimeEntriesByTask,
  WrapUpReviewLineItemDecision,
  WrapUpReviewUnplannedDecision,
  WrapUpV2Projection,
} from '../../../lib/planning/wrap-up-v2-model';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';

type WrapUpMode = 'archive-and-complete' | 'save-review-only';

interface UseWrapUpSheetModelV2Params {
  isOpen: boolean;
  plan: Plan;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onClose: () => void;
  onCompleted: (updatedPlan: Plan) => void | Promise<void>;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function buildArchiveTaskIds(
  lineItemDecisions: WrapUpReviewLineItemDecision[],
  unplannedDecisions: WrapUpReviewUnplannedDecision[],
): string[] {
  const taskIds = lineItemDecisions.flatMap((decision) => decision.linkedTaskIds);
  for (const decision of unplannedDecisions) {
    if (decision.sourceTask != null) {
      taskIds.push(decision.sourceTask.id);
    }
  }
  return uniqueStrings(taskIds);
}

export function useWrapUpSheetModelV2({
  isOpen,
  plan,
  tasks,
  timeEntriesByTask,
  onClose,
  onCompleted,
}: UseWrapUpSheetModelV2Params) {
  const [projection, setProjection] = useState<WrapUpV2Projection | null>(null);
  const [lineItemDecisions, setLineItemDecisions] = useState<Map<string, WrapUpReviewLineItemDecision>>(new Map());
  const [unplannedDecisions, setUnplannedDecisions] = useState<Map<string, WrapUpReviewUnplannedDecision>>(new Map());
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingProjection(true);
      setSubmitError(null);
      trackTelemetryEvent('wrapup_v2_open');
      try {
        const nextProjection = await loadWrapUpV2Projection(plan, tasks, timeEntriesByTask as TimeEntriesByTask);
        if (cancelled) return;
        setProjection(nextProjection);

        const nextLineItemDecisions = new Map<string, WrapUpReviewLineItemDecision>();
        for (const item of nextProjection.lineItems) {
          nextLineItemDecisions.set(item.lineItem.id, {
            lineItemId: item.lineItem.id,
            includeInKpi: item.defaultIncludeInKpi,
            deferredDispositionConfirmed: item.executionStatus !== 'deferred',
            reviewNote: item.lineItem.reviewNote ?? null,
            executionStatus: item.executionStatus,
            executorNote: item.executorNote,
            blockReason: item.blockReason,
            blockCategory: item.blockCategory,
            deferredNote: item.deferredNote,
            linkedTaskIds: item.linkedTaskIds,
          });
        }
        setLineItemDecisions(nextLineItemDecisions);

        const nextUnplannedDecisions = new Map<string, WrapUpReviewUnplannedDecision>();
        for (const unplanned of nextProjection.unplanned) {
          nextUnplannedDecisions.set(unplanned.taskId, {
            taskId: unplanned.taskId,
            includeInKpi: unplanned.sourceTask != null ? unplanned.sourceTask.excludeFromKpi !== true : false,
            assignedWorkTypeId: unplanned.sourceTask?.workTypeId ?? unplanned.workTypeId ?? null,
            isImportedOnly: unplanned.isImportedOnly,
            sourceTask: unplanned.sourceTask,
          });
        }
        setUnplannedDecisions(nextUnplannedDecisions);
      } finally {
        if (!cancelled) setIsLoadingProjection(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, plan, tasks, timeEntriesByTask]);

  const lineItemDecisionList = useMemo(
    () => [...lineItemDecisions.values()],
    [lineItemDecisions],
  );

  const unplannedDecisionList = useMemo(
    () => [...unplannedDecisions.values()],
    [unplannedDecisions],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    for (const decision of lineItemDecisionList) {
      if (decision.executionStatus === 'deferred' && !decision.deferredDispositionConfirmed) {
        errors.push(`Deferred item ${decision.lineItemId} needs disposition confirmation.`);
      }
    }

    for (const decision of unplannedDecisionList) {
      if (!decision.includeInKpi) continue;
      if (decision.assignedWorkTypeId == null) {
        errors.push(`Unplanned task ${decision.taskId} needs a work type assignment.`);
      }
      if (decision.isImportedOnly) {
        errors.push(`Imported-only unplanned task ${decision.taskId} cannot be included in KPI.`);
      }
    }

    return errors;
  }, [lineItemDecisionList, unplannedDecisionList]);

  const canSubmit = validationErrors.length === 0;

  const setLineItemIncludeInKpi = useCallback((lineItemId: string, includeInKpi: boolean) => {
    setLineItemDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(lineItemId);
      if (!existing) return prev;
      if (!existing.includeInKpi && includeInKpi && existing.executionStatus === 'blocked') {
        trackTelemetryEvent('wrapup_v2_override_blocked_include');
      }
      next.set(lineItemId, { ...existing, includeInKpi });
      return next;
    });
  }, []);

  const setLineItemReviewNote = useCallback((lineItemId: string, reviewNote: string) => {
    setLineItemDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(lineItemId);
      if (!existing) return prev;
      next.set(lineItemId, { ...existing, reviewNote: reviewNote.trim() || null });
      return next;
    });
  }, []);

  const setLineItemExecutionStatus = useCallback(
    (lineItemId: string, executionStatus: import('../../../lib/planning/plan-model').LineItemExecutionStatus) => {
      setLineItemDecisions((prev) => {
        const next = new Map(prev);
        const existing = next.get(lineItemId);
        if (!existing) return prev;
        next.set(lineItemId, { ...existing, executionStatus });
        return next;
      });
    },
    [],
  );

  const setDeferredDispositionConfirmed = useCallback((lineItemId: string, confirmed: boolean) => {
    setLineItemDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(lineItemId);
      if (!existing) return prev;
      next.set(lineItemId, { ...existing, deferredDispositionConfirmed: confirmed });
      return next;
    });
  }, []);

  const setUnplannedIncludeInKpi = useCallback((taskId: string, includeInKpi: boolean) => {
    setUnplannedDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(taskId);
      if (!existing) return prev;
      next.set(taskId, { ...existing, includeInKpi });
      return next;
    });
  }, []);

  const setUnplannedAssignedWorkType = useCallback((taskId: string, assignedWorkTypeId: string | null) => {
    setUnplannedDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(taskId);
      if (!existing) return prev;
      next.set(taskId, { ...existing, assignedWorkTypeId });
      return next;
    });
  }, []);

  const runWrapUp = useCallback(async (mode: WrapUpMode) => {
    if (isSubmitting || !projection || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const lineDecisions = [...lineItemDecisions.values()];
      const unplanned = [...unplannedDecisions.values()];
      const archiveTaskIds = buildArchiveTaskIds(lineDecisions, unplanned);

      const result = await executePlanWrapUpV2({
        plan,
        lineItemDecisions: lineDecisions,
        unplannedDecisions: unplanned,
        archiveTaskIds,
        markReviewed: mode === 'archive-and-complete',
      });

      await onCompleted(result.updatedPlan);

      if (result.success) {
        trackTelemetryEvent('wrapup_v2_complete');
        onClose();
      } else {
        setSubmitError(
          `Wrap-up partial: ${result.archivedTaskIds.length}/${result.archiveAttemptedTaskIds.length} tasks archived. ` +
            `${result.failedArchiveTaskIds.length} failed.`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    isSubmitting,
    lineItemDecisions,
    onClose,
    onCompleted,
    plan,
    projection,
    unplannedDecisions,
  ]);

  return {
    projection,
    lineItemDecisions,
    unplannedDecisions,
    lineItemDecisionList,
    unplannedDecisionList,
    isLoadingProjection,
    isSubmitting,
    submitError,
    validationErrors,
    canSubmit,
    setLineItemIncludeInKpi,
    setLineItemReviewNote,
    setLineItemExecutionStatus,
    setDeferredDispositionConfirmed,
    setUnplannedIncludeInKpi,
    setUnplannedAssignedWorkType,
    runWrapUp,
  };
}

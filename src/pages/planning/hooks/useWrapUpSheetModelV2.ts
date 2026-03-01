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
  onCompleted: (updatedPlan: Plan, success: boolean) => void | Promise<void>;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Build task IDs to archive during wrap-up.
 * Only includes line-item-linked tasks where executionStatus is 'completed'.
 * Deferred, blocked, pending, and in-progress items are excluded — their tasks
 * are not completed and would fail archival. Unplanned work is never included.
 */
function buildArchiveTaskIds(lineItemDecisions: WrapUpReviewLineItemDecision[]): string[] {
  return uniqueStrings(
    lineItemDecisions
      .filter((d) => d.executionStatus === 'completed')
      .flatMap((d) => d.linkedTaskIds),
  );
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
  const [projectionLoadError, setProjectionLoadError] = useState<string | null>(null);
  const [lineItemDecisions, setLineItemDecisions] = useState<Map<string, WrapUpReviewLineItemDecision>>(new Map());
  const [unplannedDecisions, setUnplannedDecisions] = useState<Map<string, WrapUpReviewUnplannedDecision>>(new Map());
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setProjectionLoadError(null);

    const load = async () => {
      setIsLoadingProjection(true);
      setSubmitError(null);
      trackTelemetryEvent('wrapup_v2_open');
      try {
        const nextProjection = await loadWrapUpV2Projection(plan, tasks, timeEntriesByTask as TimeEntriesByTask);
        if (cancelled) return;
        setProjection(nextProjection);
        setProjectionLoadError(null);

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
      } catch (err) {
        if (!cancelled) {
          setProjectionLoadError(err instanceof Error ? err.message : 'Failed to load execution data');
        }
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

  const { validationErrors, lineItemIdsWithErrors, unplannedTaskIdsWithErrors } = useMemo(() => {
    const errors: string[] = [];
    const lineItemIds = new Set<string>();
    const unplannedTaskIds = new Set<string>();
    if (!projection) return { validationErrors: [], lineItemIdsWithErrors: lineItemIds, unplannedTaskIdsWithErrors: unplannedTaskIds };

    const lineItemById = new Map(projection.lineItems.map((item) => [item.lineItem.id, item]));
    const unplannedByTaskId = new Map(projection.unplanned.map((u) => [u.taskId, u]));

    for (const decision of lineItemDecisionList) {
      if (decision.executionStatus === 'deferred' && !decision.deferredDispositionConfirmed) {
        const item = lineItemById.get(decision.lineItemId);
        const title = item?.lineItem.title ?? decision.lineItemId;
        errors.push(`"${title}" (deferred): Confirm "Not Delivered" disposition.`);
        lineItemIds.add(decision.lineItemId);
      }
    }

    for (const decision of unplannedDecisionList) {
      if (!decision.includeInKpi) continue;
      if (decision.assignedWorkTypeId == null) {
        const u = unplannedByTaskId.get(decision.taskId);
        const title = u?.title ?? decision.taskId;
        errors.push(`"${title}" (unplanned): Assign a work type.`);
        unplannedTaskIds.add(decision.taskId);
      }
      if (decision.isImportedOnly) {
        const u = unplannedByTaskId.get(decision.taskId);
        const title = u?.title ?? decision.taskId;
        errors.push(`"${title}" (imported): Cannot include in KPI — uncheck "Include in KPI".`);
        unplannedTaskIds.add(decision.taskId);
      }
    }

    return { validationErrors: errors, lineItemIdsWithErrors: lineItemIds, unplannedTaskIdsWithErrors: unplannedTaskIds };
  }, [lineItemDecisionList, unplannedDecisionList, projection]);

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
    if (isSubmitting) return;
    if (!projection) {
      setSubmitError(projectionLoadError ?? 'Execution data not loaded. Try closing and reopening the wrap-up sheet.');
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const lineDecisions = [...lineItemDecisions.values()];
      const unplanned = [...unplannedDecisions.values()];
      const archiveTaskIds = buildArchiveTaskIds(lineDecisions);

      const result = await executePlanWrapUpV2({
        plan,
        lineItemDecisions: lineDecisions,
        unplannedDecisions: unplanned,
        archiveTaskIds,
        markReviewed: mode === 'archive-and-complete',
      });

      await onCompleted(result.updatedPlan, result.success);

      if (result.success) {
        trackTelemetryEvent('wrapup_v2_complete');
        onClose();
      } else {
        const failedDetails = result.failedArchiveTaskIds
          .map((f) => `${f.taskId}: ${f.reason}`)
          .join('; ');
        setSubmitError(
          `Wrap-up partial: ${result.archivedTaskIds.length}/${result.archiveAttemptedTaskIds.length} tasks archived. ` +
            `${result.failedArchiveTaskIds.length} failed.${failedDetails ? ` ${failedDetails}` : ''}`,
        );
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Wrap-up failed');
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
    projectionLoadError,
    unplannedDecisions,
  ]);

  return {
    projection,
    projectionLoadError,
    lineItemDecisions,
    unplannedDecisions,
    lineItemDecisionList,
    unplannedDecisionList,
    isLoadingProjection,
    isSubmitting,
    submitError,
    validationErrors,
    lineItemIdsWithErrors,
    unplannedTaskIdsWithErrors,
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

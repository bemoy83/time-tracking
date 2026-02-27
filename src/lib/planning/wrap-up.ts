import { getTask, updateTask, updatePlan } from '../db';
import { archiveTask } from '../archive/archive-action';
import { invalidateAttributionCache } from '../attribution/cache';
import { nowUtc } from '../types';
import type { Plan } from './plan-model';
import type {
  WrapUpReviewLineItemDecision,
  WrapUpReviewUnplannedDecision,
} from './wrap-up-v2-model';

export interface WrapUpInput {
  plan: Plan;
  excludeTaskIds: string[];
  archiveTaskIds: string[];
  markReviewed?: boolean;
}

export interface WrapUpArchiveFailure {
  taskId: string;
  reason: string;
}

export interface WrapUpResult {
  updatedPlan: Plan;
  success: boolean;
  excludeAttemptedTaskIds: string[];
  excludedTaskIds: string[];
  archiveAttemptedTaskIds: string[];
  archivedTaskIds: string[];
  failedArchiveTaskIds: WrapUpArchiveFailure[];
  reviewedAtSet: boolean;
}

export async function executePlanWrapUp({
  plan,
  excludeTaskIds,
  archiveTaskIds,
  markReviewed = true,
}: WrapUpInput): Promise<WrapUpResult> {
  const uniqueExcludeIds = [...new Set(excludeTaskIds)];
  const uniqueArchiveIds = [...new Set(archiveTaskIds)];
  const excludedTaskIds: string[] = [];
  const archivedTaskIds: string[] = [];
  const failedArchiveTaskIds: WrapUpArchiveFailure[] = [];

  for (const taskId of uniqueExcludeIds) {
    const task = await getTask(taskId);
    if (!task) continue;
    if (task.excludeFromKpi) continue;
    await updateTask({
      ...task,
      excludeFromKpi: true,
      updatedAt: nowUtc(),
    });
    excludedTaskIds.push(taskId);
  }

  for (const taskId of uniqueArchiveIds) {
    const result = await archiveTask(taskId);
    if (result.success) {
      archivedTaskIds.push(taskId);
    } else {
      failedArchiveTaskIds.push({
        taskId,
        reason: result.issues.length > 0
          ? result.issues.map((issue) => issue.message).join('; ')
          : 'Unknown archive failure',
      });
    }
  }

  const canMarkReviewed = markReviewed && failedArchiveTaskIds.length === 0;
  let updatedPlan = plan;
  if (canMarkReviewed) {
    const now = nowUtc();
    updatedPlan = {
      ...plan,
      status: 'reviewed',
      reviewedAt: now,
      updatedAt: now,
    };
    await updatePlan(updatedPlan);
  }

  await invalidateAttributionCache();

  return {
    updatedPlan,
    success: failedArchiveTaskIds.length === 0,
    excludeAttemptedTaskIds: uniqueExcludeIds,
    excludedTaskIds,
    archiveAttemptedTaskIds: uniqueArchiveIds,
    archivedTaskIds,
    failedArchiveTaskIds,
    reviewedAtSet: canMarkReviewed,
  };
}

export interface WrapUpV2Input {
  plan: Plan;
  lineItemDecisions: WrapUpReviewLineItemDecision[];
  unplannedDecisions: WrapUpReviewUnplannedDecision[];
  archiveTaskIds: string[];
  markReviewed?: boolean;
}

export async function executePlanWrapUpV2({
  plan,
  lineItemDecisions,
  unplannedDecisions,
  archiveTaskIds,
  markReviewed = true,
}: WrapUpV2Input): Promise<WrapUpResult> {
  const lineItemDecisionById = new Map(lineItemDecisions.map((decision) => [decision.lineItemId, decision]));
  const now = nowUtc();

  const updatedLineItems = plan.lineItems.map((lineItem) => {
    const decision = lineItemDecisionById.get(lineItem.id);
    if (!decision) return lineItem;
    return {
      ...lineItem,
      reviewNote: decision.reviewNote,
      executionStatus: decision.executionStatus,
      executorNote: decision.executorNote,
      blockReason: decision.blockReason,
      blockCategory: decision.blockCategory,
      deferredNote: decision.deferredNote,
    };
  });

  const planWithReviewInputs: Plan = {
    ...plan,
    lineItems: updatedLineItems,
    updatedAt: now,
  };

  const excludeTaskIds: string[] = [];
  for (const decision of lineItemDecisions) {
    if (!decision.includeInKpi) {
      excludeTaskIds.push(...decision.linkedTaskIds);
    }
  }

  for (const decision of unplannedDecisions) {
    if (decision.sourceTask == null) continue;
    const task = decision.sourceTask;

    if (decision.assignedWorkTypeId != null && task.workTypeId !== decision.assignedWorkTypeId) {
      await updateTask({
        ...task,
        workTypeId: decision.assignedWorkTypeId,
        updatedAt: nowUtc(),
      });
    }

    if (!decision.includeInKpi) {
      excludeTaskIds.push(task.id);
    } else {
      const latest = await getTask(task.id);
      if (latest && latest.excludeFromKpi) {
        await updateTask({
          ...latest,
          excludeFromKpi: false,
          updatedAt: nowUtc(),
        });
      }
    }
  }

  return executePlanWrapUp({
    plan: planWithReviewInputs,
    excludeTaskIds,
    archiveTaskIds,
    markReviewed,
  });
}

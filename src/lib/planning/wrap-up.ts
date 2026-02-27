import { getTask, updateTask, updatePlan } from '../db';
import { archiveTask } from '../archive/archive-action';
import { invalidateAttributionCache } from '../attribution/cache';
import { nowUtc } from '../types';
import type { Plan } from './plan-model';

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

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

export async function executePlanWrapUp({
  plan,
  excludeTaskIds,
  archiveTaskIds,
  markReviewed = true,
}: WrapUpInput): Promise<Plan> {
  const uniqueExcludeIds = [...new Set(excludeTaskIds)];
  const uniqueArchiveIds = [...new Set(archiveTaskIds)];

  for (const taskId of uniqueExcludeIds) {
    const task = await getTask(taskId);
    if (!task) continue;
    if (task.excludeFromKpi) continue;
    await updateTask({
      ...task,
      excludeFromKpi: true,
      updatedAt: nowUtc(),
    });
  }

  for (const taskId of uniqueArchiveIds) {
    const result = await archiveTask(taskId);
    if (!result.success) {
      throw new Error(`Failed to archive task ${taskId}`);
    }
  }

  let updatedPlan = plan;
  if (markReviewed) {
    const now = nowUtc();
    updatedPlan = {
      ...plan,
      reviewedAt: now,
      updatedAt: now,
    };
    await updatePlan(updatedPlan);
  }

  await invalidateAttributionCache();

  return updatedPlan;
}

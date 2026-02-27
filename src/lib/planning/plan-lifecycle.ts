import type { Task } from '../types';
import type { Plan } from './plan-model';

export function getPlanLinkedTasks(plan: Plan, tasks: Task[]): Task[] {
  return tasks.filter((task) => task.sourcePlanId === plan.id);
}

export function getUnplannedProjectTasks(plan: Plan, tasks: Task[]): Task[] {
  return tasks.filter(
    (task) => task.projectId === plan.projectId && task.sourcePlanId == null,
  );
}

export function isPlanReviewReady(plan: Plan, tasks: Task[]): boolean {
  if (plan.status !== 'active') return false;
  if (plan.reviewedAt != null) return false;

  const linked = getPlanLinkedTasks(plan, tasks);
  if (linked.length === 0) return false;

  return linked.every((task) => task.status === 'completed');
}

/** A plan is archived once its wrap-up review has been completed. */
export function isPlanArchived(plan: Plan): boolean {
  return plan.reviewedAt != null;
}

/**
 * Sort plans for sidebar display:
 * 1. Review-ready plans first (most urgent)
 * 2. Active plans next
 * 3. Draft plans last
 * Within each group, newest first by activatedAt/createdAt.
 */
export function sortPlansForSidebar(plans: Plan[], tasks: Task[]): Plan[] {
  return [...plans].sort((a, b) => {
    const aReviewReady = isPlanReviewReady(a, tasks) ? 1 : 0;
    const bReviewReady = isPlanReviewReady(b, tasks) ? 1 : 0;
    if (aReviewReady !== bReviewReady) return bReviewReady - aReviewReady;

    const statusOrder = { active: 0, draft: 1 };
    const aOrder = statusOrder[a.status] ?? 2;
    const bOrder = statusOrder[b.status] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aDate = a.activatedAt ?? a.createdAt;
    const bDate = b.activatedAt ?? b.createdAt;
    return bDate.localeCompare(aDate);
  });
}

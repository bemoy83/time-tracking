import type { Task } from '../types';
import type { Plan } from './plan-model';

/** Plan is eligible for wrap-up when all tasks are completed OR when an execution return has been imported. */
export function isPlanWrapUpEligible(
  plan: Plan,
  tasks: Task[],
  hasImportedExecutionReturn: boolean,
): boolean {
  if (plan.status !== 'active') return false;
  if (plan.reviewedAt != null) return false;

  const linked = getPlanLinkedTasks(plan, tasks);
  if (linked.length === 0) return false;

  const allCompleted = linked.every((task) => task.status === 'completed');
  if (allCompleted) return true;

  return hasImportedExecutionReturn;
}

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
  return plan.status === 'reviewed' || plan.reviewedAt != null;
}

/**
 * Sort plans for sidebar display:
 * 1. Wrap-up-eligible plans first (most urgent)
 * 2. Active plans next
 * 3. Draft plans last
 * Within each group, newest first by activatedAt/createdAt.
 */
export function sortPlansForSidebar(
  plans: Plan[],
  tasks: Task[],
  planIdsWithImportedExecutionReturns?: Set<string>,
): Plan[] {
  const hasImports = planIdsWithImportedExecutionReturns ?? new Set<string>();
  return [...plans].sort((a, b) => {
    const aEligible = isPlanWrapUpEligible(a, tasks, hasImports.has(a.id)) ? 1 : 0;
    const bEligible = isPlanWrapUpEligible(b, tasks, hasImports.has(b.id)) ? 1 : 0;
    if (aEligible !== bEligible) return bEligible - aEligible;

    const statusOrder = { active: 0, draft: 1, reviewed: 2, received: 3, 'session-closed': 4 };
    const aOrder = statusOrder[a.status] ?? 2;
    const bOrder = statusOrder[b.status] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aDate = a.activatedAt ?? a.createdAt;
    const bDate = b.activatedAt ?? b.createdAt;
    return bDate.localeCompare(aDate);
  });
}

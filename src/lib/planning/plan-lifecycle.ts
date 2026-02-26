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
  if (plan.status !== 'locked') return false;
  if (plan.reviewedAt != null) return false;

  const linked = getPlanLinkedTasks(plan, tasks);
  if (linked.length === 0) return false;

  return linked.every((task) => task.status === 'completed');
}

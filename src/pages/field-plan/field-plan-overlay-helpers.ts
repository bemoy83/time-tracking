import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import type { FieldPlanLineItemSummary } from './field-plan-model';
import type { FieldPlanStatusGroups } from './field-plan-overlay-types';

export function isExecutorPlan(plan: Plan): boolean {
  return plan.status === 'received' || plan.status === 'session-closed';
}

export function sortExecutorPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const aPriority = a.status === 'received' ? 0 : 1;
    const bPriority = b.status === 'received' ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDate = a.status === 'received' ? (a.importedAt ?? a.updatedAt) : (a.sessionClosedAt ?? a.updatedAt);
    const bDate = b.status === 'received' ? (b.importedAt ?? b.updatedAt) : (b.sessionClosedAt ?? b.updatedAt);
    return bDate.localeCompare(aDate);
  });
}

export function formatPlanPersonHours(plan: Plan, tasks: Task[], timeEntries: TimeEntry[]): string {
  const linkedTaskIds = new Set(
    tasks
      .filter((task) => task.sourcePlanId === plan.id)
      .map((task) => task.id),
  );

  const personHours = timeEntries.reduce((total, entry) => {
    if (!linkedTaskIds.has(entry.taskId)) return total;
    const start = new Date(entry.startUtc).getTime();
    const end = new Date(entry.endUtc).getTime();
    const hours = Math.max(0, end - start) / 3_600_000;
    return total + (hours * (entry.workers ?? 1));
  }, 0);

  return `${personHours.toFixed(1)}h`;
}

export function groupByStatus(lineItems: FieldPlanLineItemSummary[]): FieldPlanStatusGroups {
  const inProgress: FieldPlanLineItemSummary[] = [];
  const blocked: FieldPlanLineItemSummary[] = [];
  const pending: FieldPlanLineItemSummary[] = [];
  const completed: FieldPlanLineItemSummary[] = [];
  const deferred: FieldPlanLineItemSummary[] = [];

  for (const li of lineItems) {
    switch (li.status) {
      case 'in-progress':
        inProgress.push(li);
        break;
      case 'blocked':
        blocked.push(li);
        break;
      case 'pending':
        pending.push(li);
        break;
      case 'completed':
        completed.push(li);
        break;
      case 'deferred':
        deferred.push(li);
        break;
    }
  }

  return { inProgress, blocked, pending, completed, deferred };
}

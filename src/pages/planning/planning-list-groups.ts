import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import { isPlanArchived, sortPlansForSidebar } from '../../lib/planning/plan-lifecycle';

export interface PlanGroups {
  inProgressPlans: Plan[];
  readyPlans: Plan[];
  draftPlans: Plan[];
  archivedPlans: Plan[];
}

export function groupPlans(
  plans: Plan[],
  tasks: Task[],
  planIdsWithImportedExecutionReturns: Set<string>,
): PlanGroups {
  const inProgress: Plan[] = [];
  const ready: Plan[] = [];
  const drafts: Plan[] = [];
  const archived: Plan[] = [];
  for (const plan of plans) {
    if (plan.status === 'received' || plan.status === 'session-closed') continue;
    if (isPlanArchived(plan)) {
      archived.push(plan);
    } else if (plan.status === 'draft') {
      drafts.push(plan);
    } else if (plan.handedOffAt != null) {
      inProgress.push(plan);
    } else {
      ready.push(plan);
    }
  }
  return {
    inProgressPlans: sortPlansForSidebar(inProgress, tasks, planIdsWithImportedExecutionReturns),
    readyPlans: sortPlansForSidebar(ready, tasks, planIdsWithImportedExecutionReturns),
    draftPlans: sortPlansForSidebar(drafts, tasks, planIdsWithImportedExecutionReturns),
    archivedPlans: archived.sort((a, b) =>
      (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''),
    ),
  };
}

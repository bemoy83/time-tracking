import type { Plan, PlanLineItem, LineItemExecutionStatus, PhaseFields } from '../../lib/planning/plan-model';
import { getPhaseFields, getPlanDisplayName, isPhaseActive } from '../../lib/planning/plan-model';
import type { Project, Task, TimeEntry, BuildPhase } from '../../lib/types';
import { BUILD_PHASES } from '../../lib/types';
import {
  evaluateLineItemDeadline,
  type DeadlineStatus,
} from '../../lib/planning/scheduling/deadline';

export interface FieldPlanLineItemSummary {
  item: PlanLineItem;
  phase: BuildPhase;
  phaseFields: PhaseFields;
  tasks: Task[];
  status: LineItemExecutionStatus;
  deadlineStatus: DeadlineStatus;
  dueDate: string | null;
  planId: string;
  planTitle: string;
  planProjectId: string | null;
  planCanExecute: boolean;
}

export const STATUS_PRIORITY: Record<LineItemExecutionStatus, number> = {
  blocked: 0,
  'in-progress': 1,
  pending: 2,
  completed: 3,
  deferred: 4,
};

export function deriveLineItemStatus(pf: PhaseFields, tasks: Task[]): LineItemExecutionStatus {
  if (pf.executionStatus === 'blocked' || pf.executionStatus === 'deferred') {
    return pf.executionStatus;
  }

  if (tasks.some((task) => task.status === 'blocked')) {
    return 'blocked';
  }

  if (tasks.length === 0) {
    return 'pending';
  }

  if (tasks.every((task) => task.status === 'completed')) {
    return 'completed';
  }

  if (tasks.some((task) => task.status === 'active')) {
    return 'in-progress';
  }

  return 'pending';
}

export function buildFieldPlanLineItemSummaries(
  plan: Plan,
  tasks: Task[],
  timeEntries: TimeEntry[],
  projectById?: Map<string, Project>,
): FieldPlanLineItemSummary[] {
  const planCanExecute = plan.status === 'received' || plan.status === 'session-closed';
  const linkedByLineItem = new Map<string, Task[]>();
  const entriesByTaskId = new Map<string, TimeEntry[]>();
  const todayDate = new Date().toISOString().slice(0, 10);
  const planTitle = getPlanDisplayName(
    plan,
    plan.projectId && projectById ? projectById.get(plan.projectId) ?? null : null,
  );

  for (const entry of timeEntries) {
    if (!entriesByTaskId.has(entry.taskId)) {
      entriesByTaskId.set(entry.taskId, []);
    }
    entriesByTaskId.get(entry.taskId)?.push(entry);
  }

  for (const task of tasks) {
    if (task.sourcePlanId !== plan.id || task.sourceLineItemId == null) {
      continue;
    }
    const lineItemId = task.sourceLineItemId;
    if (!linkedByLineItem.has(lineItemId)) {
      linkedByLineItem.set(lineItemId, []);
    }
    linkedByLineItem.get(lineItemId)?.push(task);
  }

  const summaries: FieldPlanLineItemSummary[] = [];

  for (const item of plan.lineItems) {
    const linkedTasks = linkedByLineItem.get(item.id) ?? [];

    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      const phaseTasks = linkedTasks.filter((task) => {
        if (task.phase == null) {
          return phase === 'assembly';
        }
        return task.phase === phase;
      });
      const phaseEntries = phaseTasks.flatMap((task) => entriesByTaskId.get(task.id) ?? []);
      const deadline = evaluateLineItemDeadline(item, phase, phaseTasks, phaseEntries, todayDate);
      summaries.push({
        item,
        phase,
        phaseFields: pf,
        tasks: phaseTasks,
        status: deriveLineItemStatus(pf, phaseTasks),
        deadlineStatus: deadline.status,
        dueDate: deadline.dueDate,
        planId: plan.id,
        planTitle,
        planProjectId: plan.projectId,
        planCanExecute,
      });
    }
  }

  return summaries.sort((a, b) => {
    const byPriority = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byPriority !== 0) return byPriority;
    return a.item.title.localeCompare(b.item.title);
  });
}

export function summarizeLineItemStatuses(lineItems: FieldPlanLineItemSummary[]): {
  pending: number;
  inProgress: number;
  completed: number;
  blocked: number;
  deferred: number;
} {
  const summary = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
    deferred: 0,
  };

  for (const lineItem of lineItems) {
    if (lineItem.status === 'pending') summary.pending += 1;
    if (lineItem.status === 'in-progress') summary.inProgress += 1;
    if (lineItem.status === 'completed') summary.completed += 1;
    if (lineItem.status === 'blocked') summary.blocked += 1;
    if (lineItem.status === 'deferred') summary.deferred += 1;
  }

  return summary;
}

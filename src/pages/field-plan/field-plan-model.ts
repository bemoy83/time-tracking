import type { Plan, PlanLineItem, LineItemExecutionStatus } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import {
  evaluateLineItemDeadline,
  type DeadlineStatus,
} from '../../lib/planning/scheduling/deadline';

export interface FieldPlanLineItemSummary {
  item: PlanLineItem;
  tasks: Task[];
  status: LineItemExecutionStatus;
  deadlineStatus: DeadlineStatus;
  dueDate: string | null;
}

const STATUS_PRIORITY: Record<LineItemExecutionStatus, number> = {
  blocked: 0,
  'in-progress': 1,
  pending: 2,
  completed: 3,
  deferred: 4,
};

export function deriveLineItemStatus(item: PlanLineItem, tasks: Task[]): LineItemExecutionStatus {
  if (item.executionStatus === 'blocked' || item.executionStatus === 'deferred') {
    return item.executionStatus;
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
): FieldPlanLineItemSummary[] {
  const linkedByLineItem = new Map<string, Task[]>();
  const entriesByTaskId = new Map<string, TimeEntry[]>();
  const todayDate = new Date().toISOString().slice(0, 10);

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

  return plan.lineItems
    .map((item) => {
      const linkedTasks = linkedByLineItem.get(item.id) ?? [];
      const linkedEntries = linkedTasks.flatMap((task) => entriesByTaskId.get(task.id) ?? []);
      const deadline = evaluateLineItemDeadline(item, linkedTasks, linkedEntries, todayDate);
      return {
        item,
        tasks: linkedTasks,
        status: deriveLineItemStatus(item, linkedTasks),
        deadlineStatus: deadline.status,
        dueDate: deadline.dueDate,
      };
    })
    .sort((a, b) => {
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

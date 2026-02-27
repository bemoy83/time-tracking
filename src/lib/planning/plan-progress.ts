import { durationMs } from '../types';
import type { Plan } from './plan-model';
import type { Task, TimeEntry, BuildPhase, WorkUnit } from '../types';
import {
  computePlanDeadlineSummary,
  evaluateLineItemDeadline,
  type DeadlineStatus,
  type DeadlineEvaluation,
  type PlanDeadlineSummary,
} from './scheduling/deadline';

export type LineItemProgressStatus = 'completed' | 'in-progress' | 'not-started' | 'unreleased';

export interface LineItemProgress {
  lineItemId: string;
  title: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  plannedHours: number;
  plannedPersonHours: number;
  plannedProductivity: number;
  actualHours: number;
  actualPersonHours: number;
  actualProductivity: number | null;
  variancePercent: number | null;
  status: LineItemProgressStatus;
  deadlineStatus: DeadlineStatus;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  taskCount: number;
}

export interface UnplannedWorkSummary {
  hours: number;
  personHours: number;
  taskCount: number;
}

export interface PlanProgress {
  lineItems: LineItemProgress[];
  unplannedWork: UnplannedWorkSummary;
  completionRatio: number;
  orphanTasks: Task[];
  deadline: PlanDeadlineSummary;
}

interface TimeTotals {
  hours: number;
  personHours: number;
}

function buildEntryTotals(entries: TimeEntry[]): Map<string, TimeTotals> {
  const totals = new Map<string, TimeTotals>();
  for (const entry of entries) {
    const hours = durationMs(entry.startUtc, entry.endUtc) / 3_600_000;
    const personHours = hours * (entry.workers ?? 1);
    const existing = totals.get(entry.taskId);
    if (existing) {
      existing.hours += hours;
      existing.personHours += personHours;
    } else {
      totals.set(entry.taskId, { hours, personHours });
    }
  }
  return totals;
}

function resolveLineItemStatus(tasks: Task[], actualPersonHours: number): LineItemProgressStatus {
  if (tasks.length === 0) return 'unreleased';
  if (tasks.every((task) => task.status === 'completed')) return 'completed';
  if (actualPersonHours > 0 || tasks.some((task) => task.status === 'completed')) return 'in-progress';
  return 'not-started';
}

export function computePlanProgress(
  plan: Plan,
  tasks: Task[],
  timeEntries: TimeEntry[],
): PlanProgress {
  const todayDate = new Date().toISOString().slice(0, 10);
  const linkedTasks = tasks.filter((task) => task.sourcePlanId === plan.id);
  const entryTotalsByTask = buildEntryTotals(timeEntries);
  const lineItemIds = new Set(plan.lineItems.map((item) => item.id));
  const linkedTasksByLineItemId = new Map<string, Task[]>();
  const orphanTasks: Task[] = [];

  for (const task of linkedTasks) {
    if (task.sourceLineItemId == null || !lineItemIds.has(task.sourceLineItemId)) {
      orphanTasks.push(task);
      continue;
    }

    const existing = linkedTasksByLineItemId.get(task.sourceLineItemId);
    if (existing) {
      existing.push(task);
    } else {
      linkedTasksByLineItemId.set(task.sourceLineItemId, [task]);
    }
  }

  const deadlineEvaluations: DeadlineEvaluation[] = [];

  const lineItems: LineItemProgress[] = plan.lineItems.map((item) => {
    const tasksForItem = linkedTasksByLineItemId.get(item.id) ?? [];
    let actualHours = 0;
    let actualPersonHours = 0;
    let totalTaskQuantity = 0;

    for (const task of tasksForItem) {
      const totals = entryTotalsByTask.get(task.id);
      if (totals) {
        actualHours += totals.hours;
        actualPersonHours += totals.personHours;
      }
      if (task.workQuantity != null && task.workQuantity > 0) {
        totalTaskQuantity += task.workQuantity;
      }
    }

    const plannedPersonHours = item.timeHours * item.crew;
    const quantityForRate = totalTaskQuantity > 0 ? totalTaskQuantity : item.workQuantity;
    const actualProductivity =
      actualPersonHours > 0 && quantityForRate > 0 ? quantityForRate / actualPersonHours : null;
    const variancePercent =
      plannedPersonHours > 0 ? ((actualPersonHours - plannedPersonHours) / plannedPersonHours) * 100 : null;
    const itemTaskIds = new Set(tasksForItem.map((task) => task.id));
    const entriesForItem = timeEntries.filter((entry) => itemTaskIds.has(entry.taskId));
    const deadline = evaluateLineItemDeadline(item, tasksForItem, entriesForItem, todayDate);
    deadlineEvaluations.push(deadline);

    return {
      lineItemId: item.id,
      title: item.title,
      workUnit: item.workUnit,
      buildPhase: item.buildPhase,
      plannedHours: item.timeHours,
      plannedPersonHours,
      plannedProductivity: item.productivityRate,
      actualHours,
      actualPersonHours,
      actualProductivity,
      variancePercent,
      status: resolveLineItemStatus(tasksForItem, actualPersonHours),
      deadlineStatus: deadline.status,
      dueDate: deadline.dueDate,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      actualStartDate: deadline.actualStartDate,
      actualEndDate: deadline.actualEndDate,
      taskCount: tasksForItem.length,
    };
  });

  const unplannedTasks = tasks.filter(
    (task) => task.projectId === plan.projectId && task.sourcePlanId == null,
  );
  let unplannedHours = 0;
  let unplannedPersonHours = 0;
  for (const task of unplannedTasks) {
    const totals = entryTotalsByTask.get(task.id);
    if (!totals) continue;
    unplannedHours += totals.hours;
    unplannedPersonHours += totals.personHours;
  }

  const linkedCompletedCount = linkedTasks.filter((task) => task.status === 'completed').length;
  const completionRatio = linkedTasks.length > 0 ? linkedCompletedCount / linkedTasks.length : 0;
  const deadline = computePlanDeadlineSummary(plan, deadlineEvaluations, todayDate);

  return {
    lineItems,
    unplannedWork: {
      hours: unplannedHours,
      personHours: unplannedPersonHours,
      taskCount: unplannedTasks.length,
    },
    completionRatio,
    orphanTasks,
    deadline,
  };
}

import { durationMs } from '../types';
import type { Plan } from './plan-model';
import type { Task, TimeEntry, BuildPhase, WorkUnit } from '../types';

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

  return {
    lineItems,
    unplannedWork: {
      hours: unplannedHours,
      personHours: unplannedPersonHours,
      taskCount: unplannedTasks.length,
    },
    completionRatio,
    orphanTasks,
  };
}

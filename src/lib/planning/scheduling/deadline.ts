import type { BuildPhase } from '../../types';
import { BUILD_PHASES } from '../../types';
import type { Plan, PlanLineItem } from '../plan-model';
import { getPhaseFields, isPhaseActive } from '../plan-model';
import type { Task, TimeEntry } from '../../types';

export type DeadlineStatus =
  | 'unscheduled'
  | 'due-today'
  | 'on-track'
  | 'at-risk'
  | 'overdue'
  | 'done-on-time'
  | 'done-late'
  | 'needs-replanning';

export interface DeadlineEvaluation {
  status: DeadlineStatus;
  dueDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
}

export interface PlanDeadlineSummary {
  enabled: boolean;
  label: string | null;
  status: 'on-track' | 'at-risk' | 'behind' | null;
}

function toDatePart(iso: string): string {
  return iso.slice(0, 10);
}

function dateFromEntry(entries: TimeEntry[], pick: 'start' | 'end'): string | null {
  if (entries.length === 0) return null;
  let best = pick === 'start' ? entries[0].startUtc : entries[0].endUtc;
  for (let i = 1; i < entries.length; i += 1) {
    const candidate = pick === 'start' ? entries[i].startUtc : entries[i].endUtc;
    if (pick === 'start') {
      if (candidate < best) best = candidate;
    } else if (candidate > best) {
      best = candidate;
    }
  }
  return toDatePart(best);
}

function computeHoursSpent(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => {
    const start = new Date(entry.startUtc).getTime();
    const end = new Date(entry.endUtc).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return sum;
    return sum + (((end - start) / 3_600_000) * (entry.workers ?? 1));
  }, 0);
}

function computeCompletionRatio(item: PlanLineItem, _phase: BuildPhase, tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const quantity = item.workQuantity;
  const completedQty = completedTasks.reduce((sum, task) => sum + Math.max(0, task.workQuantity ?? 0), 0);
  const denominator = quantity > 0
    ? quantity
    : tasks.reduce((sum, task) => sum + Math.max(0, task.workQuantity ?? 0), 0);

  if (denominator > 0) {
    return Math.max(0, Math.min(1, completedQty / denominator));
  }
  return completedTasks.length / tasks.length;
}

function isCompleted(tasks: Task[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.status === 'completed');
}

function isInProgress(tasks: Task[]): boolean {
  return tasks.some((task) => task.status === 'active' || task.status === 'completed');
}

function paceAtRisk(item: PlanLineItem, phase: BuildPhase, tasks: Task[], entries: TimeEntry[]): boolean {
  const pf = getPhaseFields(item, phase);
  const plannedPersonHours = pf.timeHours * pf.crew;
  if (plannedPersonHours <= 0) return false;
  const actualPersonHours = computeHoursSpent(entries);
  if (actualPersonHours <= 0) return false;
  const completionRatio = computeCompletionRatio(item, phase, tasks);
  return (actualPersonHours / plannedPersonHours) > completionRatio;
}

export function evaluateLineItemDeadline(
  item: PlanLineItem,
  phase: BuildPhase,
  tasks: Task[],
  entries: TimeEntry[],
  todayDate: string,
): DeadlineEvaluation {
  const pf = getPhaseFields(item, phase);
  const dueDate = pf.scheduledEnd ?? pf.scheduledStart;
  const actualStartDate = dateFromEntry(entries, 'start');
  const actualEndDate = dateFromEntry(entries, 'end');

  if (!dueDate) {
    return { status: 'unscheduled', dueDate: null, actualStartDate, actualEndDate };
  }

  if (pf.executionStatus === 'blocked' || pf.executionStatus === 'deferred') {
    return { status: 'needs-replanning', dueDate, actualStartDate, actualEndDate };
  }

  if (isCompleted(tasks)) {
    if (actualEndDate && actualEndDate <= dueDate) {
      return { status: 'done-on-time', dueDate, actualStartDate, actualEndDate };
    }
    return { status: 'done-late', dueDate, actualStartDate, actualEndDate };
  }

  if (todayDate > dueDate) {
    return { status: 'overdue', dueDate, actualStartDate, actualEndDate };
  }

  if (todayDate === dueDate && !isInProgress(tasks)) {
    return { status: 'due-today', dueDate, actualStartDate, actualEndDate };
  }

  if (isInProgress(tasks)) {
    return {
      status: paceAtRisk(item, phase, tasks, entries) ? 'at-risk' : 'on-track',
      dueDate,
      actualStartDate,
      actualEndDate,
    };
  }

  return { status: 'on-track', dueDate, actualStartDate, actualEndDate };
}

export function computePlanDeadlineSummary(
  plan: Plan,
  statuses: DeadlineEvaluation[],
  todayDate: string,
): PlanDeadlineSummary {
  // Count scheduled phase entries (each item can have up to 2 phases scheduled)
  let scheduledCount = 0;
  for (const item of plan.lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      if (pf.scheduledStart || pf.scheduledEnd) scheduledCount++;
    }
  }

  if (scheduledCount === 0) {
    return { enabled: false, label: null, status: null };
  }

  const doneLike = statuses.filter((entry) =>
    entry.status === 'done-on-time' || entry.status === 'done-late',
  ).length;
  const atRiskLike = statuses.filter((entry) => entry.status === 'at-risk').length;
  const behindLike = statuses.filter((entry) =>
    entry.status === 'overdue' || entry.status === 'needs-replanning',
  ).length;

  const dayIndex = plan.workCalendar.findIndex((day) => day.date === todayDate);
  const workDays = plan.workCalendar.filter((day) => day.isWorkDay).length;
  const dayLabel = dayIndex >= 0 ? `Day ${dayIndex + 1}` : 'Day ?';

  const status: PlanDeadlineSummary['status'] =
    behindLike > 0 ? 'behind'
      : atRiskLike > 0 ? 'at-risk'
        : 'on-track';

  return {
    enabled: true,
    label: `${dayLabel}${workDays > 0 ? ` of ${workDays}` : ''} - ${doneLike} of ${scheduledCount} work packages complete`,
    status,
  };
}

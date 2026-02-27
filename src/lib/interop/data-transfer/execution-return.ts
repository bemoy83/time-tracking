import type { Plan, LineItemExecutionStatus } from '../../planning/plan-model';
import type { Task, TimeEntry } from '../../types';
import { durationMs, nowUtc } from '../../types';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type ExecutionReturnPayload,
} from './contracts';

function deriveStatusFromTasks(
  itemStatus: LineItemExecutionStatus,
  linkedTasks: Task[],
): LineItemExecutionStatus {
  if (itemStatus === 'blocked' || itemStatus === 'deferred') return itemStatus;
  if (linkedTasks.length === 0) return 'pending';
  if (linkedTasks.every((task) => task.status === 'completed')) return 'completed';
  if (linkedTasks.some((task) => task.status === 'active')) return 'in-progress';
  return itemStatus;
}

export function buildExecutionReturnEnvelope(
  plan: Plan,
  tasks: Task[],
  timeEntries: TimeEntry[],
): DataTransferEnvelope<ExecutionReturnPayload> {
  const planTasks = tasks.filter((task) => task.sourcePlanId === plan.id);
  const unplannedTasks = tasks.filter(
    (task) => task.projectId === plan.projectId && task.sourcePlanId == null,
  );
  const planTaskIds = new Set(planTasks.map((task) => task.id));
  const unplannedTaskIds = new Set(unplannedTasks.map((task) => task.id));
  const planEntries = timeEntries.filter((entry) => planTaskIds.has(entry.taskId));
  const unplannedEntries = timeEntries.filter((entry) => unplannedTaskIds.has(entry.taskId));
  const relevantEntries = [...planEntries, ...unplannedEntries];

  const summaryByStatus = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
    deferred: 0,
  };

  const lineItems = plan.lineItems.map((item) => {
    const linked = planTasks.filter((task) => task.sourceLineItemId === item.id);
    const status = deriveStatusFromTasks(item.executionStatus, linked);
    if (status === 'pending') summaryByStatus.pending += 1;
    if (status === 'in-progress') summaryByStatus.inProgress += 1;
    if (status === 'completed') summaryByStatus.completed += 1;
    if (status === 'blocked') summaryByStatus.blocked += 1;
    if (status === 'deferred') summaryByStatus.deferred += 1;
    return {
      lineItemId: item.id,
      title: item.title,
      executionStatus: status,
      blockReason: item.blockReason,
      blockCategory: item.blockCategory,
      executorNote: item.executorNote,
      deferredNote: item.deferredNote,
      removedFromSource: item.removedFromSource,
    };
  });

  const totalPersonHours = relevantEntries.reduce((sum, entry) => {
    const ms = durationMs(entry.startUtc, entry.endUtc);
    return sum + ((ms / 3_600_000) * (entry.workers ?? 1));
  }, 0);

  const payload: ExecutionReturnPayload = {
    planId: plan.id,
    planTitle: plan.title,
    closedAt: nowUtc(),
    summary: {
      completed: summaryByStatus.completed,
      blocked: summaryByStatus.blocked,
      deferred: summaryByStatus.deferred,
      pending: summaryByStatus.pending,
      inProgress: summaryByStatus.inProgress,
      unplannedTaskCount: unplannedTasks.length,
      totalPersonHours: Number(totalPersonHours.toFixed(2)),
    },
    lineItems,
    tasks: planTasks,
    unplannedTasks,
    timeEntries: relevantEntries,
  };

  return {
    schemaVersion: DATA_TRANSFER_SCHEMA_VERSION,
    exportType: 'execution-return',
    exportedAt: nowUtc(),
    appVersion: '0.0.1',
    payload,
  };
}

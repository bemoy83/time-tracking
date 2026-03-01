import type { Plan, LineItemExecutionStatus } from '../../planning/plan-model';
import type { Task, TimeEntry, WorkType } from '../../types';
import { durationMs, nowUtc } from '../../types';
import { evaluateLineItemDeadline } from '../../planning/scheduling/deadline';
import { getAllWorkTypes } from '../../db';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type ExecutionReturnPayload,
  type ScheduleSection,
  type ScheduleDayEntry,
} from './contracts';
import { getEffectiveCrewForDate } from '../../planning/plan-model';
import { listDateRange } from '../../planning/scheduling/work-calendar';

function deriveStatusFromTasks(
  itemStatus: LineItemExecutionStatus,
  linkedTasks: Task[],
): LineItemExecutionStatus {
  if (itemStatus === 'blocked' || itemStatus === 'deferred') return itemStatus;
  if (linkedTasks.length === 0) return 'pending';
  if (linkedTasks.some((task) => task.status === 'blocked')) return 'blocked';
  if (linkedTasks.every((task) => task.status === 'completed')) return 'completed';
  if (linkedTasks.some((task) => task.status === 'active')) return 'in-progress';
  return itemStatus;
}

export async function buildExecutionReturnEnvelope(
  plan: Plan,
  tasks: Task[],
  timeEntries: TimeEntry[],
): Promise<DataTransferEnvelope<ExecutionReturnPayload>> {
  const todayDate = new Date().toISOString().slice(0, 10);
  const planTasks = tasks.filter((task) => task.sourcePlanId === plan.id);
  const planTasksByLineItem = new Map<string, Task[]>();
  for (const task of planTasks) {
    if (task.sourceLineItemId == null) continue;
    if (!planTasksByLineItem.has(task.sourceLineItemId)) {
      planTasksByLineItem.set(task.sourceLineItemId, []);
    }
    planTasksByLineItem.get(task.sourceLineItemId)?.push(task);
  }

  const entriesByTaskId = new Map<string, TimeEntry[]>();
  for (const entry of timeEntries) {
    if (!entriesByTaskId.has(entry.taskId)) {
      entriesByTaskId.set(entry.taskId, []);
    }
    entriesByTaskId.get(entry.taskId)?.push(entry);
  }

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
    const linked = planTasksByLineItem.get(item.id) ?? [];
    const linkedEntries = linked.flatMap((task) => entriesByTaskId.get(task.id) ?? []);
    const status = deriveStatusFromTasks(item.executionStatus, linked);
    const blockedTaskReason =
      status === 'blocked' && item.blockReason == null
        ? (linked.find((task) => task.status === 'blocked')?.blockReason ?? null)
        : null;
    const deadline = evaluateLineItemDeadline(item, linked, linkedEntries, todayDate);
    if (status === 'pending') summaryByStatus.pending += 1;
    if (status === 'in-progress') summaryByStatus.inProgress += 1;
    if (status === 'completed') summaryByStatus.completed += 1;
    if (status === 'blocked') summaryByStatus.blocked += 1;
    if (status === 'deferred') summaryByStatus.deferred += 1;
    return {
      lineItemId: item.id,
      title: item.title,
      executionStatus: status,
      blockReason: blockedTaskReason ?? item.blockReason,
      blockCategory: item.blockCategory,
      executorNote: item.executorNote,
      deferredNote: item.deferredNote,
      removedFromSource: item.removedFromSource,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      crewByDate: item.crewByDate ?? undefined,
      actualStartDate: deadline.actualStartDate,
      actualEndDate: deadline.actualEndDate,
      deadlineStatusAtClose: deadline.status,
    };
  });

  // Build structured schedule section
  const schedule = buildScheduleSection(plan);

  const totalPersonHours = relevantEntries.reduce((sum, entry) => {
    const ms = durationMs(entry.startUtc, entry.endUtc);
    return sum + ((ms / 3_600_000) * (entry.workers ?? 1));
  }, 0);

  const referencedWorkTypeIds = new Set<string>();
  for (const task of [...planTasks, ...unplannedTasks]) {
    if (task.workTypeId != null) referencedWorkTypeIds.add(task.workTypeId);
  }
  const allWorkTypes = await getAllWorkTypes();
  const workTypeById = new Map(
    allWorkTypes
      .filter((wt) => referencedWorkTypeIds.has(wt.id))
      .map((wt) => [wt.id, wt]),
  );
  const planLineItemBySourceId = new Map(plan.lineItems.map((item) => [item.id, item]));
  const workTypes: WorkType[] = [];
  const exportedIds = new Set<string>();
  const syntheticById = new Map<string, string>();
  const syntheticTimestamp = nowUtc();

  for (const task of [...planTasks, ...unplannedTasks]) {
    if (task.workTypeId == null) continue;
    if (exportedIds.has(task.workTypeId)) continue;

    const existing = workTypeById.get(task.workTypeId);
    if (existing) {
      workTypes.push(existing);
      exportedIds.add(task.workTypeId);
      continue;
    }

    const lineItem = task.sourceLineItemId ? planLineItemBySourceId.get(task.sourceLineItemId) : null;
    const syntheticId = `exec-return-${plan.id}-${task.workTypeId}`;
    syntheticById.set(task.workTypeId, syntheticId);
    exportedIds.add(task.workTypeId);

    if (lineItem) {
      workTypes.push({
        id: syntheticId,
        title: lineItem.workTypeTitle,
        workUnit: lineItem.workUnit,
        buildPhase: lineItem.buildPhase,
        expectedProductivity: lineItem.productivityRate,
        createdAt: syntheticTimestamp,
        updatedAt: syntheticTimestamp,
      });
    } else {
      workTypes.push({
        id: syntheticId,
        title: task.title,
        workUnit: task.workUnit ?? 'm2',
        buildPhase: task.buildPhase ?? 'build-up',
        expectedProductivity: 10,
        createdAt: syntheticTimestamp,
        updatedAt: syntheticTimestamp,
      });
    }
  }

  const remappedPlanTasks = planTasks.map((task) => {
    if (task.workTypeId == null) return task;
    const existing = workTypeById.get(task.workTypeId);
    if (existing) return task;
    const syntheticId = syntheticById.get(task.workTypeId);
    return syntheticId ? { ...task, workTypeId: syntheticId } : task;
  });
  const remappedUnplannedTasks = unplannedTasks.map((task) => {
    if (task.workTypeId == null) return task;
    const existing = workTypeById.get(task.workTypeId);
    if (existing) return task;
    const syntheticId = syntheticById.get(task.workTypeId);
    return syntheticId ? { ...task, workTypeId: syntheticId } : task;
  });

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
    schedule,
    tasks: remappedPlanTasks,
    unplannedTasks: remappedUnplannedTasks,
    timeEntries: relevantEntries,
    workTypes,
  };

  return {
    schemaVersion: DATA_TRANSFER_SCHEMA_VERSION,
    exportType: 'execution-return',
    exportedAt: nowUtc(),
    appVersion: '0.0.1',
    payload,
  };
}

function buildScheduleSection(plan: Plan): ScheduleSection {
  const dayMap = new Map<string, ScheduleDayEntry>();

  for (const item of plan.lineItems) {
    if (!item.scheduledStart || !item.scheduledEnd) continue;
    const dates = listDateRange(item.scheduledStart, item.scheduledEnd);
    const totalPH = item.timeHours * item.crew;
    const hasCrewByDate = item.crewByDate && Object.keys(item.crewByDate).length > 0;

    if (hasCrewByDate) {
      const effectiveCrews = dates.map((d) => getEffectiveCrewForDate(item, d));
      const sumCrew = effectiveCrews.reduce((s, c) => s + c, 0);
      const safeSumCrew = sumCrew > 0 ? sumCrew : item.crew * dates.length;

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const crew = effectiveCrews[i];
        const ph = totalPH * (crew / safeSumCrew);
        if (!dayMap.has(date)) dayMap.set(date, { date, lineItems: [] });
        dayMap.get(date)!.lineItems.push({
          lineItemId: item.id,
          title: item.title,
          assignedCrew: crew,
          plannedPersonHours: Number(ph.toFixed(2)),
        });
      }
    } else {
      const perDay = dates.length > 0 ? totalPH / dates.length : 0;
      for (const date of dates) {
        if (!dayMap.has(date)) dayMap.set(date, { date, lineItems: [] });
        dayMap.get(date)!.lineItems.push({
          lineItemId: item.id,
          title: item.title,
          assignedCrew: item.crew,
          plannedPersonHours: Number(perDay.toFixed(2)),
        });
      }
    }
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days };
}

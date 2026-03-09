import type { Plan, LineItemExecutionStatus } from '../../planning/plan-model';
import { getPhaseFields, isPhaseActive, getEffectiveCrewForDate } from '../../planning/plan-model';
import type { Task, TimeEntry, WorkType } from '../../types';
import { BUILD_PHASES, durationMs, nowUtc } from '../../types';
import { evaluateLineItemDeadline } from '../../planning/scheduling/deadline';
import { getAllWorkTypes } from '../../db';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type ExecutionReturnPayload,
  type ScheduleSection,
  type ScheduleDayEntry,
} from './contracts';
import { listDateRange } from '../../planning/scheduling/work-calendar';

const PHASE_LINE_ITEM_ID_SEPARATOR = '::phase::';

function resolveSourceWorkPackageId(lineItemId: string): string | null {
  const idx = lineItemId.lastIndexOf(PHASE_LINE_ITEM_ID_SEPARATOR);
  if (idx <= 0) return null;
  return lineItemId.slice(0, idx);
}

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

  // For each line item, emit one entry per active phase
  const lineItems = plan.lineItems.flatMap((item) => {
    const linked = planTasksByLineItem.get(item.id) ?? [];

    return BUILD_PHASES
      .filter((phase) => isPhaseActive(item, phase))
      .map((phase) => {
        const pf = getPhaseFields(item, phase);
        // Filter linked tasks to this phase
        const phaseTasks = linked.filter((task) => task.buildPhase === phase);
        const status = deriveStatusFromTasks(pf.executionStatus, phaseTasks);
        const blockedTaskReason =
          status === 'blocked' && pf.blockReason == null
            ? (phaseTasks.find((task) => task.status === 'blocked')?.blockReason ?? null)
            : null;

        const phaseEntries = phaseTasks.flatMap((task) => entriesByTaskId.get(task.id) ?? []);
        const deadline = evaluateLineItemDeadline(item, phase, phaseTasks, phaseEntries, todayDate);

        if (status === 'pending') summaryByStatus.pending += 1;
        if (status === 'in-progress') summaryByStatus.inProgress += 1;
        if (status === 'completed') summaryByStatus.completed += 1;
        if (status === 'blocked') summaryByStatus.blocked += 1;
        if (status === 'deferred') summaryByStatus.deferred += 1;

        return {
          lineItemId: item.id,
          phase,
          sourceWorkPackageId: resolveSourceWorkPackageId(item.id),
          title: item.title,
          executionStatus: status,
          blockReason: blockedTaskReason ?? pf.blockReason,
          blockCategory: pf.blockCategory,
          executorNote: pf.executorNote,
          deferredNote: pf.deferredNote,
          removedFromSource: item.removedFromSource,
          scheduledStart: pf.scheduledStart,
          scheduledEnd: pf.scheduledEnd,
          crewByDate: pf.crewByDate ?? undefined,
          actualStartDate: deadline.actualStartDate,
          actualEndDate: deadline.actualEndDate,
          deadlineStatusAtClose: deadline.status,
        };
      });
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
        buildUpRate: lineItem.buildUpRate,
        tearDownRate: lineItem.tearDownRate,
        createdAt: syntheticTimestamp,
        updatedAt: syntheticTimestamp,
      });
    } else {
      const isTearDown = task.buildPhase === 'tear-down';
      workTypes.push({
        id: syntheticId,
        title: task.title,
        workUnit: task.workUnit ?? 'm2',
        buildUpRate: isTearDown ? 0 : 10,
        tearDownRate: isTearDown ? 10 : 0,
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
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      if (!pf.scheduledStart || !pf.scheduledEnd) continue;

      const dates = listDateRange(pf.scheduledStart, pf.scheduledEnd);
      const totalPH = pf.timeHours * pf.crew;
      const perDay = dates.length > 0 ? totalPH / dates.length : 0;

      for (const date of dates) {
        const crew = getEffectiveCrewForDate(item, phase, date);
        if (!dayMap.has(date)) dayMap.set(date, { date, lineItems: [] });
        dayMap.get(date)!.lineItems.push({
          lineItemId: item.id,
          title: item.title,
          assignedCrew: crew,
          plannedPersonHours: Number(perDay.toFixed(2)),
        });
      }
    }
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days };
}

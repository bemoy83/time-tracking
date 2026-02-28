import { getLatestExecutionReturnBundleByPlanId } from '../db';
import type { Plan, LineItemExecutionStatus } from './plan-model';
import type { Task, TimeEntry } from '../types';
import { durationMs } from '../types';
import type {
  TimeEntriesByTask,
  WrapUpLineItemProjection,
  WrapUpUnplannedProjection,
  WrapUpV2Projection,
} from './wrap-up-v2-model';

function deriveExecutionStatusFromTasks(tasks: Task[]): LineItemExecutionStatus {
  if (tasks.length === 0) return 'pending';
  if (tasks.every((task) => task.status === 'completed')) return 'completed';
  if (tasks.some((task) => task.status === 'active')) return 'in-progress';
  return 'pending';
}

function mergeExecutorStatus(
  localStatus: LineItemExecutionStatus,
  importedStatus: LineItemExecutionStatus | null,
  linkedTasks: Task[],
): LineItemExecutionStatus {
  if (localStatus === 'blocked' || localStatus === 'deferred') {
    return localStatus;
  }
  if (importedStatus === 'blocked' || importedStatus === 'deferred') {
    return importedStatus;
  }
  if (importedStatus === 'completed') {
    return 'completed';
  }
  return deriveExecutionStatusFromTasks(linkedTasks);
}

function resolveExecutorText(localValue: string | null, importedValue: string | null): string | null {
  if (localValue != null && localValue.trim().length > 0) {
    return localValue;
  }
  if (importedValue != null && importedValue.trim().length > 0) {
    return importedValue;
  }
  return null;
}

function computeTaskPersonHours(taskId: string, timeEntriesByTask: TimeEntriesByTask): number {
  const entries = timeEntriesByTask.get(taskId) ?? [];
  const personHours = entries.reduce((sum, entry: TimeEntry) => {
    const hours = durationMs(entry.startUtc, entry.endUtc) / 3_600_000;
    return sum + (hours * (entry.workers ?? 1));
  }, 0);
  return personHours;
}

function computeTasksPersonHours(taskIds: string[], timeEntriesByTask: TimeEntriesByTask): number {
  const total = taskIds.reduce((sum, taskId) => sum + computeTaskPersonHours(taskId, timeEntriesByTask), 0);
  return Number(total.toFixed(2));
}

export async function loadWrapUpV2Projection(
  plan: Plan,
  tasks: Task[],
  timeEntriesByTask: TimeEntriesByTask,
): Promise<WrapUpV2Projection> {
  const latestBundle = await getLatestExecutionReturnBundleByPlanId(plan.id);

  const tasksByLineItemId = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.sourcePlanId !== plan.id || task.sourceLineItemId == null) continue;
    const key = task.sourceLineItemId;
    if (!tasksByLineItemId.has(key)) {
      tasksByLineItemId.set(key, []);
    }
    tasksByLineItemId.get(key)?.push(task);
  }

  const importedLineItemById = new Map(
    (latestBundle?.lineItems ?? []).map((lineItem) => [lineItem.lineItemId, lineItem]),
  );

  const lineItems: WrapUpLineItemProjection[] = plan.lineItems.map((lineItem) => {
    const linkedTasks = tasksByLineItemId.get(lineItem.id) ?? [];
    const linkedTaskIds = linkedTasks.map((task) => task.id);
    const imported = importedLineItemById.get(lineItem.id);

    const executionStatus = mergeExecutorStatus(
      lineItem.executionStatus,
      imported?.executionStatus ?? null,
      linkedTasks,
    );

    const executorNote = resolveExecutorText(lineItem.executorNote, imported?.executorNote ?? null);
    const blockReason = resolveExecutorText(lineItem.blockReason, imported?.blockReason ?? null);
    const deferredNote = resolveExecutorText(lineItem.deferredNote, imported?.deferredNote ?? null);

    const plannedPersonHours = Number((lineItem.timeHours * lineItem.crew).toFixed(2));
    const actualPersonHours = computeTasksPersonHours(linkedTaskIds, timeEntriesByTask);
    const variancePersonHours = Number((actualPersonHours - plannedPersonHours).toFixed(2));
    const actualProductivity =
      actualPersonHours > 0 && lineItem.workQuantity > 0
        ? Number((lineItem.workQuantity / actualPersonHours).toFixed(2))
        : null;

    return {
      lineItem,
      linkedTaskIds,
      plannedPersonHours,
      actualPersonHours,
      variancePersonHours,
      actualProductivity,
      executionStatus,
      executorNote,
      blockReason,
      blockCategory: lineItem.blockCategory ?? imported?.blockCategory ?? null,
      deferredNote,
      defaultIncludeInKpi: executionStatus !== 'blocked' && executionStatus !== 'deferred',
    };
  });

  const localUnplanned = tasks.filter(
    (task) => task.projectId === plan.projectId && task.sourcePlanId == null,
  );
  const localUnplannedById = new Map(localUnplanned.map((task) => [task.id, task]));

  const unplannedFromLocal: WrapUpUnplannedProjection[] = localUnplanned.map((task) => ({
    taskId: task.id,
    title: task.title,
    isImportedOnly: false,
    workTypeId: task.workTypeId ?? null,
    workUnit: task.workUnit,
    buildPhase: task.buildPhase,
    personHours: Number(computeTaskPersonHours(task.id, timeEntriesByTask).toFixed(2)),
    sourceTask: task,
  }));

  const importedOnly: WrapUpUnplannedProjection[] = (latestBundle?.unplannedTasks ?? [])
    .filter((task) => !localUnplannedById.has(task.taskId))
    .map((task) => ({
      taskId: task.taskId,
      title: task.title,
      isImportedOnly: true,
      workTypeId: task.workTypeId,
      workUnit: task.workUnit,
      buildPhase: task.buildPhase,
      personHours: task.personHours,
      sourceTask: null,
    }));

  const unplanned = [...unplannedFromLocal, ...importedOnly].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return {
    lineItems,
    unplanned,
    importedAt: latestBundle?.record.importedAt ?? null,
    closedAt: latestBundle?.record.closedAt ?? null,
  };
}

import {
  addExecutionReturnLineItems,
  addExecutionReturnRecord,
  addExecutionReturnUnplannedTasks,
  addTask,
  addTimeEntry,
  getAllTimeEntries,
  getPlan,
  getTask,
  updatePlan,
  updateTask,
} from '../../db';
import { durationMs, generateId, nowUtc, type BuildPhase, type Task, type WorkUnit } from '../../types';
import { refreshTasks } from '../../stores/task-store';
import { notifyExecutionReturnImported } from '../../planning/execution-return-import-events';
import { phaseFieldUpdates } from '../../planning/plan-model';
import {
  type DataTransferEnvelope,
  type ExecutionReturnMergeSummary,
  type ExecutionReturnLineItem,
  type ExecutionReturnImportPreview,
  type ExecutionReturnImportResult,
  type ExecutionReturnPayload,
  type ImportedExecutionReturnLineItemRecord,
  type ImportedExecutionReturnRecord,
  type ImportedExecutionReturnUnplannedTaskRecord,
} from './contracts';
import {
  isSupportedSchemaVersion,
  unsupportedSchemaVersionMessage,
} from './schema-version';
import { resolveImportedWorkTypeIds } from './plan-package';
import { ensureImportedWorkUnits } from '../../stores/work-unit-store';
import { provisionWorkUnitsForImport } from '../work-unit-import';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isExecutionReturnEnvelope(
  value: unknown,
): value is DataTransferEnvelope<ExecutionReturnPayload> {
  if (!isRecord(value)) return false;
  if (value.exportType !== 'execution-return') return false;
  if (!isRecord(value.payload)) return false;
  const payload = value.payload;
  if (typeof payload.planId !== 'string') return false;
  if (typeof payload.planTitle !== 'string') return false;
  if (typeof payload.closedAt !== 'string') return false;
  if (!Array.isArray(payload.lineItems)) return false;
  if (!payload.lineItems.every((lineItem) =>
    isRecord(lineItem)
    && typeof lineItem.lineItemId === 'string'
    && (lineItem.phase === 'assembly' || lineItem.phase === 'dismantle')
    && (lineItem.sourceWorkPackageId == null || typeof lineItem.sourceWorkPackageId === 'string')
    && typeof lineItem.title === 'string',
  )) return false;
  if (!Array.isArray(payload.tasks)) return false;
  if (!Array.isArray(payload.unplannedTasks)) return false;
  if (!Array.isArray(payload.timeEntries)) return false;
  return true;
}

function buildDateRange(entries: ExecutionReturnPayload['timeEntries']): {
  start: string | null;
  end: string | null;
} {
  if (entries.length === 0) {
    return { start: null, end: null };
  }

  let start = entries[0].startUtc;
  let end = entries[0].endUtc;

  for (const entry of entries) {
    if (entry.startUtc < start) start = entry.startUtc;
    if (entry.endUtc > end) end = entry.endUtc;
  }

  return { start, end };
}

interface NormalizedExecutionReturnLineItem extends ExecutionReturnLineItem {
  phase: BuildPhase;
}

function normalizeExecutionReturnLineItems(
  lineItems: ExecutionReturnPayload['lineItems'],
): NormalizedExecutionReturnLineItem[] {
  return lineItems.map((lineItem) => ({
    ...lineItem,
    sourceWorkPackageId: lineItem.sourceWorkPackageId ?? lineItem.lineItemId,
  }));
}

function remapTaskSourceLineItemId(
  task: Task,
  normalizedLineItems: NormalizedExecutionReturnLineItem[],
): Task {
  if (task.sourceLineItemId == null) return task;
  const matchingLineItem = normalizedLineItems.find(
    (lineItem) =>
      lineItem.lineItemId === task.sourceLineItemId
      && lineItem.phase === task.phase,
  );
  if (!matchingLineItem) {
    return task;
  }
  return {
    ...task,
    sourceLineItemId: matchingLineItem.lineItemId,
  };
}

export function parseExecutionReturnJson(
  text: string,
): { ok: true; envelope: DataTransferEnvelope<ExecutionReturnPayload> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isExecutionReturnEnvelope(parsed)) {
      return { ok: false, error: 'Selected file is not a valid execution return export.' };
    }
    if (!isSupportedSchemaVersion(String(parsed.schemaVersion))) {
      return {
        ok: false,
        error: unsupportedSchemaVersionMessage(String(parsed.schemaVersion), 'execution-return'),
      };
    }

    return {
      ok: true,
      envelope: parsed,
    };
  } catch {
    return { ok: false, error: 'Could not parse JSON file.' };
  }
}

export async function previewExecutionReturnImport(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
): Promise<ExecutionReturnImportPreview> {
  const existingEntries = await getAllTimeEntries();
  const existingIds = new Set(existingEntries.map((entry) => entry.id));
  const duplicateTimeEntryIds = envelope.payload.timeEntries
    .map((entry) => entry.id)
    .filter((id) => existingIds.has(id));

  const range = buildDateRange(envelope.payload.timeEntries);

  return {
    planId: envelope.payload.planId,
    planTitle: envelope.payload.planTitle,
    closedAt: envelope.payload.closedAt,
    timeEntryCount: envelope.payload.timeEntries.length,
    duplicateTimeEntryIds,
    conflicts: duplicateTimeEntryIds.length > 0 ? ['duplicate-time-entry-id'] : [],
    unplannedTaskCount: envelope.payload.unplannedTasks.length,
    lineItemCount: envelope.payload.lineItems.length,
    workUnitCount: envelope.payload.workUnitDefinitions?.length ?? 0,
    dateRangeStart: range.start,
    dateRangeEnd: range.end,
    envelope,
  };
}

function buildExecutionReturnMergeSummary(args: {
  importedAt: string;
  importedEntryCount: number;
  skippedDuplicateEntryCount: number;
  mergedTaskCount: number;
  lineItemCount: number;
}): ExecutionReturnMergeSummary {
  return {
    importedAt: args.importedAt,
    importedEntryCount: args.importedEntryCount,
    skippedDuplicateEntryCount: args.skippedDuplicateEntryCount,
    mergedTaskCount: args.mergedTaskCount,
    lineItemCount: args.lineItemCount,
  };
}

export function formatExecutionReturnMergeSummary(summary: ExecutionReturnMergeSummary): string {
  return [
    `${summary.importedEntryCount} new ${summary.importedEntryCount === 1 ? 'entry' : 'entries'}`,
    `${summary.skippedDuplicateEntryCount} duplicate ${summary.skippedDuplicateEntryCount === 1 ? 'entry' : 'entries'} skipped`,
    `${summary.mergedTaskCount} ${summary.mergedTaskCount === 1 ? 'task' : 'tasks'} merged`,
    `${summary.lineItemCount} ${summary.lineItemCount === 1 ? 'line item' : 'line items'} reflected`,
  ].join(', ');
}

function buildImportedExecutionReturnRecord(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
  importedAt: string,
  id: string,
  mergeSummary: ExecutionReturnMergeSummary,
): ImportedExecutionReturnRecord {
  return {
    id,
    planId: envelope.payload.planId,
    planTitle: envelope.payload.planTitle,
    closedAt: envelope.payload.closedAt,
    importedAt,
    schemaVersion: envelope.schemaVersion,
    appVersion: envelope.appVersion,
    exportType: 'execution-return',
    exportedAt: envelope.exportedAt,
    mergeSummary,
  };
}

function buildImportedLineItems(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
  executionReturnId: string,
  importedAt: string,
  normalizedLineItems: NormalizedExecutionReturnLineItem[],
): ImportedExecutionReturnLineItemRecord[] {
  return normalizedLineItems.map((lineItem) => ({
    id: `${executionReturnId}:${lineItem.lineItemId}:${lineItem.phase}`,
    executionReturnId,
    planId: envelope.payload.planId,
    importedAt,
    lineItemId: lineItem.lineItemId,
    phase: lineItem.phase,
    sourceWorkPackageId: lineItem.sourceWorkPackageId ?? null,
    title: lineItem.title,
    executionStatus: lineItem.executionStatus,
    blockReason: lineItem.blockReason,
    blockCategory: lineItem.blockCategory,
    executorNote: lineItem.executorNote,
    deferredNote: lineItem.deferredNote,
    removedFromSource: lineItem.removedFromSource,
    scheduledStart: lineItem.scheduledStart ?? null,
    scheduledEnd: lineItem.scheduledEnd ?? null,
    actualStartDate: lineItem.actualStartDate ?? null,
    actualEndDate: lineItem.actualEndDate ?? null,
    deadlineStatusAtClose: lineItem.deadlineStatusAtClose ?? null,
  }));
}

function computeUnplannedTaskPersonHours(
  task: Task,
  entries: ExecutionReturnPayload['timeEntries'],
): number {
  const personHours = entries
    .filter((entry) => entry.taskId === task.id)
    .reduce((sum, entry) => {
      const hours = durationMs(entry.startUtc, entry.endUtc) / 3_600_000;
      return sum + (hours * (entry.workers ?? 1));
    }, 0);
  return Number(personHours.toFixed(2));
}

function buildImportedUnplannedTasks(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
  executionReturnId: string,
  importedAt: string,
): ImportedExecutionReturnUnplannedTaskRecord[] {
  return envelope.payload.unplannedTasks.map((task) => ({
    id: `${executionReturnId}:${task.id}`,
    executionReturnId,
    planId: envelope.payload.planId,
    importedAt,
    taskId: task.id,
    title: task.title,
    workTypeId: task.workTypeId ?? null,
    workUnit: task.workUnit ?? null,
    phase: task.phase,
    personHours: computeUnplannedTaskPersonHours(task, envelope.payload.timeEntries),
  }));
}

/**
 * Normalize legacy execution-return task payloads:
 * - crew <- crew | defaultWorkers
 * - blockReason <- blockReason | blockedReason
 */
function normalizeTaskFromPayload(task: Task): Task {
  const raw = task as Task & {
    defaultWorkers?: number | null;
    blockedReason?: string | null;
  };
  const {
    defaultWorkers: legacyCrew,
    blockedReason: legacyBlockReason,
    ...rest
  } = raw;
  return {
    ...rest,
    crew: rest.crew ?? legacyCrew ?? null,
    blockReason: rest.blockReason ?? legacyBlockReason ?? null,
  };
}

/** Sync task status from payload line items (authoritative executor-reported status). */
function applyImportedLineItemStatusToTasks(
  planTasks: Task[],
  payloadLineItems: NormalizedExecutionReturnLineItem[],
): Task[] {
  const statusByLineItemPhase = new Map(
    payloadLineItems.map((li) => [`${li.lineItemId}:${li.phase}`, li.executionStatus]),
  );
  return planTasks.map((task) => {
    const lineItemId = task.sourceLineItemId;
    if (lineItemId == null || task.phase == null) return task;
    const phase = task.phase;
    const importedStatus = statusByLineItemPhase.get(`${lineItemId}:${phase}`);
    if (importedStatus !== 'completed') return task;
    if (task.status === 'completed') return task;
    return { ...task, status: 'completed' as const, updatedAt: task.updatedAt };
  });
}

async function applyImportedLineItemsToPlan(
  planId: string,
  lineItems: NormalizedExecutionReturnLineItem[],
): Promise<void> {
  if (lineItems.length === 0) return;
  const plan = await getPlan(planId);
  if (!plan) return;

  const lineItemByPhase = new Map<string, NormalizedExecutionReturnLineItem>();
  const removedFromSourceByLineItem = new Map<string, boolean>();

  for (const lineItem of lineItems) {
    lineItemByPhase.set(`${lineItem.lineItemId}:${lineItem.phase}`, lineItem);
    if (lineItem.removedFromSource) {
      removedFromSourceByLineItem.set(lineItem.lineItemId, true);
    }
  }

  let changed = false;
  const nextLineItems = plan.lineItems.map((lineItem) => {
    let next = lineItem;

    for (const phase of ['assembly', 'dismantle'] as const) {
      const imported = lineItemByPhase.get(`${lineItem.id}:${phase}`);
      if (!imported) continue;
      next = {
        ...next,
        ...phaseFieldUpdates(phase, {
          executionStatus: imported.executionStatus,
          blockReason: imported.blockReason,
          blockCategory: imported.blockCategory,
          executorNote: imported.executorNote,
          deferredNote: imported.deferredNote,
        }),
      };
      changed = true;
    }

    if (removedFromSourceByLineItem.get(lineItem.id) === true && !next.removedFromSource) {
      next = {
        ...next,
        removedFromSource: true,
      };
      changed = true;
    }

    return next;
  });

  if (!changed) return;

  await updatePlan({
    ...plan,
    lineItems: nextLineItems,
    updatedAt: nowUtc(),
  });
}

async function upsertTasksFromPayload(tasks: Task[]): Promise<number> {
  let added = 0;
  for (const task of tasks) {
    const existing = await getTask(task.id);
    if (existing) {
      await updateTask(task);
    } else {
      await addTask(task);
      added += 1;
    }
  }
  return added;
}

export async function applyExecutionReturnImport(
  preview: ExecutionReturnImportPreview,
  options: { applyLabelToExistingWorkUnits?: boolean } = {},
): Promise<ExecutionReturnImportResult> {
  const existingEntries = await getAllTimeEntries();
  const existingIds = new Set(existingEntries.map((entry) => entry.id));

  const entriesToAdd = preview.envelope.payload.timeEntries.filter((entry) => !existingIds.has(entry.id));
  for (const entry of entriesToAdd) {
    await addTimeEntry(entry);
  }

  const importedAt = nowUtc();
  const executionReturnId = generateId();
  const normalizedPayloadLineItems = normalizeExecutionReturnLineItems(preview.envelope.payload.lineItems);
  const lineItems = buildImportedLineItems(
    preview.envelope,
    executionReturnId,
    importedAt,
    normalizedPayloadLineItems,
  );
  const unplannedTasks = buildImportedUnplannedTasks(preview.envelope, executionReturnId, importedAt);

  // Add or update tasks so the Planning Progress view shows execution state.
  // Sync task status from payload line items (authoritative executor-reported status).
  const { tasks: planTasks, unplannedTasks: unplannedTaskPayload, workTypes: payloadWorkTypes } =
    preview.envelope.payload;
  const normalizedPlanTasks = planTasks
    .map(normalizeTaskFromPayload)
    .map((task) => remapTaskSourceLineItemId(task, normalizedPayloadLineItems));
  const normalizedUnplannedTasks = unplannedTaskPayload.map(normalizeTaskFromPayload);
  const planTasksWithSyncedStatus = applyImportedLineItemStatusToTasks(
    normalizedPlanTasks,
    normalizedPayloadLineItems,
  );

  const inferredUnits = new Map<string, string>();
  for (const task of [...planTasksWithSyncedStatus, ...normalizedUnplannedTasks]) {
    if (task.workUnit) {
      inferredUnits.set(task.workUnit, task.workUnit);
    }
  }
  for (const workType of payloadWorkTypes ?? []) {
    inferredUnits.set(workType.workUnit, workType.workUnit);
  }
  const importedUnits = preview.envelope.payload.workUnitDefinitions?.map((definition) => ({
    id: definition.id,
    label: definition.label,
  })) ?? Array.from(inferredUnits.values()).map((unitId) => ({
    id: unitId,
    label: unitId,
  }));
  await provisionWorkUnitsForImport(
    importedUnits,
    (item) => ({
      workUnit: item.id as WorkUnit,
      workUnitLabel: item.label ?? null,
    }),
    { applyLabelToExisting: options.applyLabelToExistingWorkUnits },
    ensureImportedWorkUnits,
  );

  const workTypeIdMap =
    Array.isArray(payloadWorkTypes) && payloadWorkTypes.length > 0
      ? await resolveImportedWorkTypeIds(preview.envelope.payload.planId, payloadWorkTypes)
      : new Map<string, string>();

  const remapWorkTypeId = (task: Task): Task => {
    if (task.workTypeId == null || workTypeIdMap.size === 0) return task;
    const mapped = workTypeIdMap.get(task.workTypeId);
    return mapped != null ? { ...task, workTypeId: mapped } : task;
  };

  const planTasksToUpsert = planTasksWithSyncedStatus.map(remapWorkTypeId);
  const unplannedTasksToUpsert = normalizedUnplannedTasks.map(remapWorkTypeId);
  const mergeSummary = buildExecutionReturnMergeSummary({
    importedAt,
    importedEntryCount: entriesToAdd.length,
    skippedDuplicateEntryCount: preview.envelope.payload.timeEntries.length - entriesToAdd.length,
    mergedTaskCount: planTasksToUpsert.length + unplannedTasksToUpsert.length,
    lineItemCount: lineItems.length,
  });
  const record = buildImportedExecutionReturnRecord(
    preview.envelope,
    importedAt,
    executionReturnId,
    mergeSummary,
  );

  await addExecutionReturnRecord(record);
  await addExecutionReturnLineItems(lineItems);
  await addExecutionReturnUnplannedTasks(unplannedTasks);
  await upsertTasksFromPayload(planTasksToUpsert);
  await upsertTasksFromPayload(unplannedTasksToUpsert);
  await applyImportedLineItemsToPlan(preview.envelope.payload.planId, normalizedPayloadLineItems);
  await refreshTasks();
  notifyExecutionReturnImported();

  return {
    importedEntryCount: entriesToAdd.length,
    skippedDuplicateEntryCount: preview.envelope.payload.timeEntries.length - entriesToAdd.length,
    executionReturnId,
    lineItemCount: lineItems.length,
    unplannedTaskCount: unplannedTasks.length,
    mergeSummary,
    reason: `Imported execution return. ${formatExecutionReturnMergeSummary(mergeSummary)}.`,
  };
}

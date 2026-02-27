import {
  addExecutionReturnLineItems,
  addExecutionReturnRecord,
  addExecutionReturnUnplannedTasks,
  addTimeEntry,
  getAllTimeEntries,
} from '../../db';
import { durationMs, generateId, nowUtc, type Task } from '../../types';
import {
  type DataTransferEnvelope,
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
    dateRangeStart: range.start,
    dateRangeEnd: range.end,
    envelope,
  };
}

function buildImportedExecutionReturnRecord(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
  importedAt: string,
  id: string,
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
  };
}

function buildImportedLineItems(
  envelope: DataTransferEnvelope<ExecutionReturnPayload>,
  executionReturnId: string,
  importedAt: string,
): ImportedExecutionReturnLineItemRecord[] {
  return envelope.payload.lineItems.map((lineItem) => ({
    id: `${executionReturnId}:${lineItem.lineItemId}`,
    executionReturnId,
    planId: envelope.payload.planId,
    importedAt,
    lineItemId: lineItem.lineItemId,
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
    buildPhase: task.buildPhase ?? null,
    personHours: computeUnplannedTaskPersonHours(task, envelope.payload.timeEntries),
  }));
}

export async function applyExecutionReturnImport(
  preview: ExecutionReturnImportPreview,
): Promise<ExecutionReturnImportResult> {
  const existingEntries = await getAllTimeEntries();
  const existingIds = new Set(existingEntries.map((entry) => entry.id));

  const entriesToAdd = preview.envelope.payload.timeEntries.filter((entry) => !existingIds.has(entry.id));
  for (const entry of entriesToAdd) {
    await addTimeEntry(entry);
  }

  const importedAt = nowUtc();
  const executionReturnId = generateId();
  const record = buildImportedExecutionReturnRecord(preview.envelope, importedAt, executionReturnId);
  const lineItems = buildImportedLineItems(preview.envelope, executionReturnId, importedAt);
  const unplannedTasks = buildImportedUnplannedTasks(preview.envelope, executionReturnId, importedAt);

  await addExecutionReturnRecord(record);
  await addExecutionReturnLineItems(lineItems);
  await addExecutionReturnUnplannedTasks(unplannedTasks);

  return {
    importedEntryCount: entriesToAdd.length,
    skippedDuplicateEntryCount: preview.envelope.payload.timeEntries.length - entriesToAdd.length,
    executionReturnId,
    lineItemCount: lineItems.length,
    unplannedTaskCount: unplannedTasks.length,
    reason:
      entriesToAdd.length === preview.envelope.payload.timeEntries.length
        ? 'Imported execution return.'
        : `Imported execution return with ${preview.envelope.payload.timeEntries.length - entriesToAdd.length} duplicate entries skipped.`,
  };
}

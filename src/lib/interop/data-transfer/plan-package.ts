import { addPlan, getAllTasks, getPlan, updatePlan } from '../../db';
import {
  type Plan,
  type PlanLineItem,
  type LineItemExecutionStatus,
} from '../../planning/plan-model';
import { createWorkType, findWorkTypeByKey } from '../../stores/work-type-store';
import { nowUtc } from '../../types';
import type { WorkType } from '../../types';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type PlanPackageImportPreview,
  type PlanPackagePayload,
} from './contracts';
import { reconcileWorkCalendar } from '../../planning/scheduling/work-calendar';
import {
  isSupportedSchemaVersion,
  unsupportedSchemaVersionMessage,
} from './schema-version';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function coerceExecutionStatus(value: unknown): LineItemExecutionStatus {
  if (
    value === 'pending' ||
    value === 'in-progress' ||
    value === 'completed' ||
    value === 'blocked' ||
    value === 'deferred'
  ) {
    return value;
  }
  return 'pending';
}

function normalizeImportedLineItem(raw: PlanLineItem): PlanLineItem {
  return {
    ...raw,
    executionStatus: coerceExecutionStatus(raw.executionStatus),
    blockReason: raw.blockReason ?? null,
    blockCategory: raw.blockCategory ?? null,
    executorNote: raw.executorNote ?? null,
    deferredNote: raw.deferredNote ?? null,
    removedFromSource: raw.removedFromSource ?? false,
    scheduledStart: raw.scheduledStart ?? null,
    scheduledEnd: raw.scheduledEnd ?? null,
    originalScheduledStart: raw.originalScheduledStart ?? null,
    originalScheduledEnd: raw.originalScheduledEnd ?? null,
    amendmentNote: raw.amendmentNote ?? null,
    amendedAt: raw.amendedAt ?? null,
  };
}

function normalizeIncomingPlan(plan: Plan): Plan {
  const now = nowUtc();
  const normalizedCalendar = reconcileWorkCalendar(
    plan.workCalendar ?? [],
    plan.eventStartDate ?? null,
    plan.eventEndDate ?? null,
    plan.defaultCrewSize ?? null,
  );
  return {
    ...plan,
    status: 'received',
    reviewedAt: null,
    importedAt: now,
    sessionClosedAt: null,
    updatedAt: now,
    eventStartDate: plan.eventStartDate ?? null,
    eventEndDate: plan.eventEndDate ?? null,
    defaultCrewSize: plan.defaultCrewSize ?? null,
    workCalendar: normalizedCalendar,
    lineItems: plan.lineItems.map((item) =>
      normalizeImportedLineItem({
        ...item,
        executionStatus: 'pending',
        blockReason: null,
        blockCategory: null,
        executorNote: null,
        deferredNote: null,
        removedFromSource: false,
      }),
    ),
  };
}

function hasExecutionState(plan: Plan): boolean {
  if (plan.status === 'session-closed') {
    return true;
  }
  return plan.lineItems.some((item) => (
    item.executionStatus !== 'pending' ||
    item.blockReason != null ||
    item.blockCategory != null ||
    item.executorNote != null ||
    item.deferredNote != null ||
    item.removedFromSource
  ));
}

async function hasExecutionStateForPlan(plan: Plan): Promise<boolean> {
  if (hasExecutionState(plan)) {
    return true;
  }
  const tasks = await getAllTasks();
  return tasks.some((task) => task.sourcePlanId === plan.id);
}

function isPlannerStatus(status: Plan['status']): boolean {
  return status === 'draft' || status === 'active' || status === 'reviewed';
}

export function parsePlanPackageJson(
  text: string,
): { ok: true; envelope: DataTransferEnvelope<PlanPackagePayload> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, error: 'Invalid JSON structure' };
    }
    if (parsed.exportType !== 'plan-package') {
      return { ok: false, error: 'Selected file is not a plan package export' };
    }
    if (!isSupportedSchemaVersion(String(parsed.schemaVersion))) {
      return {
        ok: false,
        error: unsupportedSchemaVersionMessage(String(parsed.schemaVersion), 'plan-package'),
      };
    }
    if (!isRecord(parsed.payload)) {
      return { ok: false, error: 'Missing export payload' };
    }
    const payload = parsed.payload;
    if (!isRecord(payload.plan)) {
      return { ok: false, error: 'Invalid plan payload' };
    }
    if (!Array.isArray(payload.workTypes)) {
      return { ok: false, error: 'Invalid work type payload' };
    }
    return {
      ok: true,
      envelope: parsed as unknown as DataTransferEnvelope<PlanPackagePayload>,
    };
  } catch {
    return { ok: false, error: 'Could not parse JSON file' };
  }
}

export function createPlanPackageEnvelope(
  payload: PlanPackagePayload,
): DataTransferEnvelope<PlanPackagePayload> {
  return {
    schemaVersion: DATA_TRANSFER_SCHEMA_VERSION,
    exportType: 'plan-package',
    exportedAt: nowUtc(),
    appVersion: '0.0.1',
    payload,
  };
}

async function resolveImportedWorkTypeIds(
  planId: string,
  workTypes: WorkType[],
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  for (const imported of workTypes) {
    const existing = findWorkTypeByKey(imported.title, imported.workUnit, imported.buildPhase);
    if (existing && (existing.readOnly !== true || existing.importedForPlanId === planId)) {
      mapping.set(imported.id, existing.id);
      continue;
    }
    const created = await createWorkType({
      title: imported.title,
      workUnit: imported.workUnit,
      buildPhase: imported.buildPhase,
      expectedProductivity: imported.expectedProductivity,
      readOnly: true,
      importedForPlanId: planId,
    });
    mapping.set(imported.id, created.id);
  }
  return mapping;
}

function mergeReceivedPlan(existing: Plan, incoming: Plan): Plan {
  const existingById = new Map(existing.lineItems.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.lineItems.map((item) => item.id));

  const mergedItems: PlanLineItem[] = incoming.lineItems.map((incomingItem) => {
    const existingItem = existingById.get(incomingItem.id);
    if (!existingItem) {
      return normalizeImportedLineItem({
        ...incomingItem,
        executionStatus: 'pending',
        blockReason: null,
        blockCategory: null,
        executorNote: null,
        deferredNote: null,
        removedFromSource: false,
      });
    }
    return normalizeImportedLineItem({
      ...incomingItem,
      executionStatus: existingItem.executionStatus,
      blockReason: existingItem.blockReason,
      blockCategory: existingItem.blockCategory,
      executorNote: existingItem.executorNote,
      deferredNote: existingItem.deferredNote,
      removedFromSource: false,
    });
  });

  for (const previous of existing.lineItems) {
    if (incomingIds.has(previous.id)) continue;
    mergedItems.push({
      ...previous,
      removedFromSource: true,
    });
  }

  return {
    ...incoming,
    createdAt: existing.createdAt,
    importedAt: nowUtc(),
    status: existing.status === 'session-closed' ? 'session-closed' : 'received',
    sessionClosedAt: existing.sessionClosedAt ?? null,
    workCalendar: reconcileWorkCalendar(
      incoming.workCalendar,
      incoming.eventStartDate ?? null,
      incoming.eventEndDate ?? null,
      incoming.defaultCrewSize ?? null,
    ),
    lineItems: mergedItems,
  };
}

export async function previewPlanPackageImport(
  envelope: DataTransferEnvelope<PlanPackagePayload>,
): Promise<PlanPackageImportPreview> {
  const importedPlan = envelope.payload.plan;
  const existing = await getPlan(importedPlan.id);
  let conflict: PlanPackageImportPreview['conflict'] = 'none';
  let existingStatus: Plan['status'] | null = null;

  if (existing) {
    existingStatus = existing.status;
    if (isPlannerStatus(existing.status)) {
      conflict = 'planner-plan';
    } else if (await hasExecutionStateForPlan(existing)) {
      conflict = 'merge';
    } else {
      conflict = 'replace-or-skip';
    }
  }

  return {
    planId: importedPlan.id,
    title: importedPlan.title,
    lineItemCount: importedPlan.lineItems.length,
    workTypeCount: envelope.payload.workTypes.length,
    lastModifiedAt: envelope.payload.lastModifiedAt ?? importedPlan.updatedAt,
    conflict,
    existingStatus,
    envelope,
  };
}

export async function applyPlanPackageImport(
  preview: PlanPackageImportPreview,
  resolution: 'replace' | 'skip' = 'replace',
): Promise<{ applied: boolean; merged: boolean; reason: string }> {
  const envelope = preview.envelope;
  const importedPlan = normalizeIncomingPlan(envelope.payload.plan);
  const existing = await getPlan(importedPlan.id);

  if (existing && isPlannerStatus(existing.status)) {
    return {
      applied: false,
      merged: false,
      reason: 'Cannot import over planner-owned plan on this device.',
    };
  }

  const hasExistingExecution = existing ? await hasExecutionStateForPlan(existing) : false;

  if (existing && !hasExistingExecution) {
    if (resolution === 'skip') {
      return {
        applied: false,
        merged: false,
        reason: 'Skipped existing received plan.',
      };
    }
  }

  const workTypeIdMap = await resolveImportedWorkTypeIds(importedPlan.id, envelope.payload.workTypes);
  const remappedLineItems = importedPlan.lineItems.map((item) => ({
    ...item,
    workTypeId: item.workTypeId ? (workTypeIdMap.get(item.workTypeId) ?? item.workTypeId) : null,
  }));
  const mappedPlan = {
    ...importedPlan,
    lineItems: remappedLineItems,
  };

  if (!existing) {
    await addPlan(mappedPlan);
    return {
      applied: true,
      merged: false,
      reason: 'Imported plan package.',
    };
  }

  const merged = hasExistingExecution;
  const next = merged ? mergeReceivedPlan(existing, mappedPlan) : mappedPlan;
  await updatePlan(next);

  return {
    applied: true,
    merged,
    reason: merged ? 'Merged plan package update.' : 'Replaced received plan.',
  };
}

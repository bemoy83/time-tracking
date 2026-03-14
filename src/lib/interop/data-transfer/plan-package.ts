import { addPlan, addProject, getAllProjects, getAllTasks, getAllWorkTypes, getPlan, getProject, updatePlan } from '../../db';
import {
  type Plan,
  type PlanLineItem,
  type LineItemExecutionStatus,
  getPhaseFields,
} from '../../planning/plan-model';
import { createWorkType, findWorkTypeByKey } from '../../stores/work-type-store';
import { nowUtc } from '../../types';
import type { Project, WorkType } from '../../types';
import { BUILD_PHASES, generateId } from '../../types';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type PlanPackageSerializedLineItem,
  type PlanPackageImportPreview,
  type PlanPackageLineItemDiff,
  type PlanPackageLineItemDiffSummary,
  type PlanPackagePayload,
} from './contracts';
import { getWorkCalendarPhaseSpans, readPhaseDateValues } from '../../planning/scheduling/schedule-span';
import { reconcileWorkCalendarForSpans } from '../../planning/scheduling/work-calendar';
import {
  isSupportedSchemaVersion,
  unsupportedSchemaVersionMessage,
} from './schema-version';
import { sanitizeFileNameSegment } from '../../utils/sanitize-filename';
import { downloadJson } from '../download-json';
import { isPlanInPlannerState } from '../../planning/plan-lifecycle';

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

function normalizeCrewByDate(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) continue;
    result[key] = Math.floor(num);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function isCanonicalSerializedLineItem(value: unknown): value is PlanPackageSerializedLineItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.workTypeTitle === 'string'
    && typeof value.workUnit === 'string'
    && typeof value.assemblyRate === 'number'
    && typeof value.dismantleRate === 'number'
    && typeof value.assemblyCrew === 'number'
    && typeof value.dismantleCrew === 'number'
    && typeof value.assemblyTimeHours === 'number'
    && typeof value.dismantleTimeHours === 'number'
    && typeof value.assemblyRateSource === 'string'
    && typeof value.dismantleRateSource === 'string'
    && typeof value.assemblyExecutionStatus === 'string'
    && typeof value.dismantleExecutionStatus === 'string'
    && typeof value.removedFromSource === 'boolean'
  );
}

function normalizeSerializedLineItems(lineItems: PlanPackageSerializedLineItem[]): PlanLineItem[] {
  return lineItems.map((lineItem) => normalizeImportedLineItem(lineItem));
}

function normalizeImportedLineItem(raw: PlanLineItem): PlanLineItem {
  return {
    ...raw,
    assemblyExecutionStatus: coerceExecutionStatus(raw.assemblyExecutionStatus),
    assemblyBlockReason: raw.assemblyBlockReason ?? null,
    assemblyBlockCategory: raw.assemblyBlockCategory ?? null,
    assemblyExecutorNote: raw.assemblyExecutorNote ?? null,
    assemblyDeferredNote: raw.assemblyDeferredNote ?? null,
    dismantleExecutionStatus: coerceExecutionStatus(raw.dismantleExecutionStatus),
    dismantleBlockReason: raw.dismantleBlockReason ?? null,
    dismantleBlockCategory: raw.dismantleBlockCategory ?? null,
    dismantleExecutorNote: raw.dismantleExecutorNote ?? null,
    dismantleDeferredNote: raw.dismantleDeferredNote ?? null,
    removedFromSource: raw.removedFromSource ?? false,
    assemblyCrewByDate: normalizeCrewByDate(raw.assemblyCrewByDate),
    assemblyScheduledStart: raw.assemblyScheduledStart ?? null,
    assemblyScheduledEnd: raw.assemblyScheduledEnd ?? null,
    assemblyOriginalScheduledStart: raw.assemblyOriginalScheduledStart ?? null,
    assemblyOriginalScheduledEnd: raw.assemblyOriginalScheduledEnd ?? null,
    dismantleCrewByDate: normalizeCrewByDate(raw.dismantleCrewByDate),
    dismantleScheduledStart: raw.dismantleScheduledStart ?? null,
    dismantleScheduledEnd: raw.dismantleScheduledEnd ?? null,
    dismantleOriginalScheduledStart: raw.dismantleOriginalScheduledStart ?? null,
    dismantleOriginalScheduledEnd: raw.dismantleOriginalScheduledEnd ?? null,
    amendmentNote: raw.amendmentNote ?? null,
    amendedAt: raw.amendedAt ?? null,
  };
}

function resetPhaseExecutionState(): Partial<PlanLineItem> {
  return {
    assemblyExecutionStatus: 'pending',
    assemblyBlockReason: null,
    assemblyBlockCategory: null,
    assemblyExecutorNote: null,
    assemblyDeferredNote: null,
    dismantleExecutionStatus: 'pending',
    dismantleBlockReason: null,
    dismantleBlockCategory: null,
    dismantleExecutorNote: null,
    dismantleDeferredNote: null,
  };
}

function normalizeIncomingPlan(plan: PlanPackagePayload['plan']): Plan {
  const normalizedLineItems = normalizeSerializedLineItems(plan.lineItems ?? []);
  const now = nowUtc();
  const normalizedDates: Plan = {
    ...(plan as Plan),
    eventStartDate: plan.eventStartDate ?? null,
    eventEndDate: plan.eventEndDate ?? null,
    assemblyStartDate: plan.assemblyStartDate ?? null,
    assemblyEndDate: plan.assemblyEndDate ?? null,
    dismantleStartDate: plan.dismantleStartDate ?? null,
    dismantleEndDate: plan.dismantleEndDate ?? null,
  };
  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(normalizedDates));
  const normalizedCalendar = reconcileWorkCalendarForSpans(
    normalizedDates.workCalendar ?? [],
    phaseSpans,
    normalizedDates.defaultCrewSize ?? null,
  );
  return {
    ...normalizedDates,
    status: 'received',
    reviewedAt: null,
    importedAt: now,
    sessionClosedAt: null,
    updatedAt: now,
    defaultCrewSize: normalizedDates.defaultCrewSize ?? null,
    workCalendar: normalizedCalendar,
    lineItems: normalizedLineItems.map((item) => ({
      ...item,
      ...resetPhaseExecutionState(),
      removedFromSource: false,
    })),
  };
}

function hasExecutionState(plan: Plan): boolean {
  if (plan.status === 'session-closed') {
    return true;
  }
  return plan.lineItems.some((item) => {
    for (const phase of BUILD_PHASES) {
      const pf = getPhaseFields(item, phase);
      if (
        pf.executionStatus !== 'pending' ||
        pf.blockReason != null ||
        pf.blockCategory != null ||
        pf.executorNote != null ||
        pf.deferredNote != null
      ) {
        return true;
      }
    }
    return item.removedFromSource;
  });
}

async function hasExecutionStateForPlan(plan: Plan): Promise<boolean> {
  if (hasExecutionState(plan)) {
    return true;
  }
  const tasks = await getAllTasks();
  return tasks.some((task) => task.sourcePlanId === plan.id);
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
    if (typeof payload.plan.id !== 'string' || typeof payload.plan.title !== 'string') {
      return { ok: false, error: 'Invalid plan metadata' };
    }
    if (!Array.isArray(payload.plan.lineItems)) {
      return { ok: false, error: 'Invalid line item payload' };
    }
    if (!payload.plan.lineItems.every(isCanonicalSerializedLineItem)) {
      return { ok: false, error: 'Invalid line item payload. Only canonical dual-phase line items are supported.' };
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

export async function buildPlanPackagePayload(plan: Plan): Promise<PlanPackagePayload> {
  const referencedWorkTypeIds = new Set(
    plan.lineItems
      .map((item) => item.workTypeId)
      .filter((workTypeId): workTypeId is string => workTypeId != null),
  );
  const allWorkTypes = await getAllWorkTypes();
  const workTypeById = new Map(
    allWorkTypes
      .filter((workType) => referencedWorkTypeIds.has(workType.id))
      .map((workType) => [workType.id, workType]),
  );

  const workTypes: WorkType[] = [];
  const exportedWorkTypeIds = new Set<string>();
  const syntheticTimestamp = nowUtc();

  const remappedLineItems = plan.lineItems.map((item) => {
    if (item.workTypeId == null) {
      return item;
    }

    const existing = workTypeById.get(item.workTypeId);
    if (existing) {
      if (!exportedWorkTypeIds.has(existing.id)) {
        workTypes.push(existing);
        exportedWorkTypeIds.add(existing.id);
      }
      return item;
    }

    const syntheticId = `plan-export-${plan.id}-${item.id}`;
    if (!exportedWorkTypeIds.has(syntheticId)) {
      workTypes.push({
        id: syntheticId,
        title: item.workTypeTitle,
        workUnit: item.workUnit,
        assemblyRate: item.assemblyRate,
        dismantleRate: item.dismantleRate,
        createdAt: syntheticTimestamp,
        updatedAt: syntheticTimestamp,
      });
      exportedWorkTypeIds.add(syntheticId);
    }

    return {
      ...item,
      workTypeId: syntheticId,
    };
  });

  const projects: Project[] = [];
  if (plan.projectId) {
    const project = await getProject(plan.projectId);
    if (project) {
      projects.push(project);
    }
  }

  return {
    plan: {
      ...plan,
      lineItems: remappedLineItems,
    },
    workTypes,
    projects: projects.length > 0 ? projects : undefined,
    lastModifiedAt: plan.updatedAt,
  };
}

export async function exportPlanPackage(plan: Plan): Promise<void> {
  const payload = await buildPlanPackagePayload(plan);
  const envelope = createPlanPackageEnvelope(payload);
  const filename = `plan-package-${sanitizeFileNameSegment(plan.title)}-${plan.updatedAt.slice(0, 10)}.json`;
  downloadJson(filename, envelope);
}

export async function resolveImportedWorkTypeIds(
  planId: string,
  workTypes: WorkType[],
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  for (const imported of workTypes) {
    const existing = findWorkTypeByKey(imported.title, imported.workUnit);
    if (existing && (existing.readOnly !== true || existing.importedForPlanId === planId)) {
      mapping.set(imported.id, existing.id);
      continue;
    }
    const created = await createWorkType({
      title: imported.title,
      workUnit: imported.workUnit,
      assemblyRate: imported.assemblyRate ?? 0,
      dismantleRate: imported.dismantleRate ?? 0,
      readOnly: true,
      importedForPlanId: planId,
    });
    mapping.set(imported.id, created.id);
  }
  return mapping;
}

async function resolveImportedProjectId(
  planProjectId: string | null,
  payloadProjects: Project[] | undefined,
): Promise<string | null> {
  if (!planProjectId) return null;
  if (!payloadProjects?.length) return null;

  const importedProject = payloadProjects.find((p) => p.id === planProjectId);
  if (!importedProject) return null;

  const existingProjects = await getAllProjects();
  const match = existingProjects.find(
    (p) => p.name === importedProject.name && p.color === importedProject.color,
  );
  if (match) return match.id;

  const now = nowUtc();
  const newProject: Project = {
    id: generateId(),
    name: importedProject.name,
    color: importedProject.color,
    createdAt: now,
    updatedAt: now,
    assemblyStartDate: importedProject.assemblyStartDate ?? null,
    assemblyEndDate: importedProject.assemblyEndDate ?? null,
    dismantleStartDate: importedProject.dismantleStartDate ?? null,
    dismantleEndDate: importedProject.dismantleEndDate ?? null,
    eventStartDate: importedProject.eventStartDate ?? null,
    eventEndDate: importedProject.eventEndDate ?? null,
  };
  await addProject(newProject);
  return newProject.id;
}

function mergeReceivedPlan(existing: Plan, incoming: Plan): Plan {
  const existingById = new Map(existing.lineItems.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.lineItems.map((item) => item.id));

  const mergedItems: PlanLineItem[] = incoming.lineItems.map((incomingItem) => {
    const existingItem = existingById.get(incomingItem.id);
    if (!existingItem) {
      return normalizeImportedLineItem({
        ...incomingItem,
        ...resetPhaseExecutionState(),
        removedFromSource: false,
      });
    }
    return normalizeImportedLineItem({
      ...incomingItem,
      assemblyExecutionStatus: existingItem.assemblyExecutionStatus,
      assemblyBlockReason: existingItem.assemblyBlockReason,
      assemblyBlockCategory: existingItem.assemblyBlockCategory,
      assemblyExecutorNote: existingItem.assemblyExecutorNote,
      assemblyDeferredNote: existingItem.assemblyDeferredNote,
      dismantleExecutionStatus: existingItem.dismantleExecutionStatus,
      dismantleBlockReason: existingItem.dismantleBlockReason,
      dismantleBlockCategory: existingItem.dismantleBlockCategory,
      dismantleExecutorNote: existingItem.dismantleExecutorNote,
      dismantleDeferredNote: existingItem.dismantleDeferredNote,
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

  const normalizedIncoming: Plan = {
    ...incoming,
    eventStartDate: incoming.eventStartDate ?? null,
    eventEndDate: incoming.eventEndDate ?? null,
    assemblyStartDate: incoming.assemblyStartDate ?? null,
    assemblyEndDate: incoming.assemblyEndDate ?? null,
    dismantleStartDate: incoming.dismantleStartDate ?? null,
    dismantleEndDate: incoming.dismantleEndDate ?? null,
  };
  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(normalizedIncoming));

  return {
    ...normalizedIncoming,
    createdAt: existing.createdAt,
    importedAt: nowUtc(),
    status: 'received',
    sessionClosedAt: null,
    workCalendar: reconcileWorkCalendarForSpans(
      normalizedIncoming.workCalendar,
      phaseSpans,
      normalizedIncoming.defaultCrewSize ?? null,
    ),
    lineItems: mergedItems,
  };
}

const DIFF_FIELDS = [
  'title',
  'workQuantity',
  'dismantleQuantity',
  'assemblyRate', 'assemblyCrew', 'assemblyTimeHours',
  'assemblyRateSource',
  'dismantleRate', 'dismantleCrew', 'dismantleTimeHours',
  'dismantleRateSource',
  'assemblyScheduledStart', 'assemblyScheduledEnd',
  'assemblyOriginalScheduledStart', 'assemblyOriginalScheduledEnd',
  'dismantleScheduledStart', 'dismantleScheduledEnd',
  'dismantleOriginalScheduledStart', 'dismantleOriginalScheduledEnd',
] as const;

function shallowEqualCrewByDate(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

export function diffPlanPackageLineItems(
  existing: Plan,
  incoming: Plan,
): PlanPackageLineItemDiff[] {
  const existingById = new Map(existing.lineItems.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.lineItems.map((item) => item.id));
  const diffs: PlanPackageLineItemDiff[] = [];

  for (const incomingItem of incoming.lineItems) {
    const existingItem = existingById.get(incomingItem.id);
    if (!existingItem) {
      diffs.push({ lineItemId: incomingItem.id, title: incomingItem.title, action: 'new' });
      continue;
    }
    const changedFields: string[] = [];
    for (const field of DIFF_FIELDS) {
      if (incomingItem[field] !== existingItem[field]) {
        changedFields.push(field);
      }
    }
    if (!shallowEqualCrewByDate(incomingItem.assemblyCrewByDate, existingItem.assemblyCrewByDate)) {
      changedFields.push('assemblyCrewByDate');
    }
    if (!shallowEqualCrewByDate(incomingItem.dismantleCrewByDate, existingItem.dismantleCrewByDate)) {
      changedFields.push('dismantleCrewByDate');
    }
    diffs.push({
      lineItemId: incomingItem.id,
      title: incomingItem.title,
      action: changedFields.length > 0 ? 'updated' : 'unchanged',
      changedFields: changedFields.length > 0 ? changedFields : undefined,
    });
  }

  for (const existingItem of existing.lineItems) {
    if (!incomingIds.has(existingItem.id)) {
      diffs.push({ lineItemId: existingItem.id, title: existingItem.title, action: 'removed' });
    }
  }

  return diffs;
}

function computeDiffSummary(diffs: PlanPackageLineItemDiff[]): PlanPackageLineItemDiffSummary {
  return {
    new: diffs.filter((d) => d.action === 'new').length,
    updated: diffs.filter((d) => d.action === 'updated').length,
    unchanged: diffs.filter((d) => d.action === 'unchanged').length,
    removed: diffs.filter((d) => d.action === 'removed').length,
  };
}

export async function previewPlanPackageImport(
  envelope: DataTransferEnvelope<PlanPackagePayload>,
): Promise<PlanPackageImportPreview> {
  const importedPlan = normalizeIncomingPlan(envelope.payload.plan);
  const existing = await getPlan(importedPlan.id);
  let conflict: PlanPackageImportPreview['conflict'] = 'none';
  let existingStatus: Plan['status'] | null = null;

  if (existing) {
    existingStatus = existing.status;
    if (isPlanInPlannerState(existing)) {
      conflict = 'planner-plan';
    } else if (await hasExecutionStateForPlan(existing)) {
      conflict = 'merge';
    } else {
      conflict = 'replace-or-skip';
    }
  }

  const lineItemDiffs = existing
    ? diffPlanPackageLineItems(existing, importedPlan)
    : undefined;
  const lineItemDiffSummary = lineItemDiffs
    ? computeDiffSummary(lineItemDiffs)
    : undefined;

  return {
    planId: importedPlan.id,
    title: importedPlan.title,
    lineItemCount: importedPlan.lineItems.length,
    workTypeCount: envelope.payload.workTypes.length,
    lastModifiedAt: envelope.payload.lastModifiedAt ?? importedPlan.updatedAt,
    conflict,
    existingStatus,
    envelope,
    lineItemDiffs,
    lineItemDiffSummary,
  };
}

export interface PlanPackageMergeSummary {
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  removedCount: number;
}

export async function applyPlanPackageImport(
  preview: PlanPackageImportPreview,
  resolution: 'replace' | 'skip' = 'replace',
): Promise<{ applied: boolean; merged: boolean; reason: string; mergeSummary?: PlanPackageMergeSummary }> {
  const envelope = preview.envelope;
  const importedPlan = normalizeIncomingPlan(envelope.payload.plan);
  const existing = await getPlan(importedPlan.id);

  if (existing && isPlanInPlannerState(existing)) {
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
  const resolvedProjectId = await resolveImportedProjectId(
    importedPlan.projectId,
    envelope.payload.projects,
  );
  const mappedPlan = {
    ...importedPlan,
    projectId: resolvedProjectId ?? null,
    lineItems: remappedLineItems,
  };

  if (!existing) {
    await addPlan(mappedPlan);
    if (resolvedProjectId) {
      const { refreshProjects } = await import('../../stores/task-store');
      await refreshProjects();
    }
    return {
      applied: true,
      merged: false,
      reason: 'Imported plan package.',
    };
  }

  const merged = hasExistingExecution;
  const next = merged ? mergeReceivedPlan(existing, mappedPlan) : mappedPlan;
  await updatePlan(next);

  if (resolvedProjectId) {
    const { refreshProjects } = await import('../../stores/task-store');
    await refreshProjects();
  }

  let mergeSummary: PlanPackageMergeSummary | undefined;
  if (merged) {
    const diffs = diffPlanPackageLineItems(existing, mappedPlan);
    const summary = computeDiffSummary(diffs);
    mergeSummary = {
      newCount: summary.new,
      updatedCount: summary.updated,
      unchangedCount: summary.unchanged,
      removedCount: summary.removed,
    };
  }

  return {
    applied: true,
    merged,
    reason: merged ? 'Merged plan package update.' : 'Replaced received plan.',
    mergeSummary,
  };
}

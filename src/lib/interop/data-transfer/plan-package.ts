import {
  addPlan,
  addProject,
  getAllProjects,
  getAllTasks,
  getAllWorkTypes,
  getAllWorkUnitDefinitions,
  getPlan,
  getProject,
  updatePlan,
  getAllTags,
  getAllTagCategories,
} from '../../db';
import {
  createTag,
  createTagCategory,
} from '../../stores/tag-store';
import { normalizeTagName, normalizeTagCategoryName } from '../../tags';
import {
  type Plan,
  type PlanLineItem,
  type LineItemExecutionStatus,
  getPhaseFields,
  normalizePlanEfficiency,
} from '../../planning/plan-model';
import { ensureImportedWorkUnits } from '../../stores/work-unit-store';
import { createWorkType, findWorkTypeByKey } from '../../stores/work-type-store';
import { normalizeProjectName, nowUtc } from '../../types';
import type { Project, WorkType, WorkUnit } from '../../types';
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
import { provisionWorkUnitsForImport } from '../work-unit-import';
import { isPlanInPlannerState } from '../../planning/plan-lifecycle';
import { refreshProjectsInTaskStore } from '../../stores/task-store-project-sync';

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

function normalizePersonHoursByDate(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) continue;
    result[key] = Number(num.toFixed(2));
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
    assemblyPersonHoursByDate: normalizePersonHoursByDate(raw.assemblyPersonHoursByDate),
    assemblyScheduledStart: raw.assemblyScheduledStart ?? null,
    assemblyScheduledEnd: raw.assemblyScheduledEnd ?? null,
    assemblyOriginalScheduledStart: raw.assemblyOriginalScheduledStart ?? null,
    assemblyOriginalScheduledEnd: raw.assemblyOriginalScheduledEnd ?? null,
    dismantlePersonHoursByDate: normalizePersonHoursByDate(raw.dismantlePersonHoursByDate),
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
    defaultEfficiency: normalizePlanEfficiency((normalizedDates as unknown as Record<string, unknown>).defaultEfficiency as number | null | undefined) ?? null,
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
  const referencedWorkUnitIds = new Set<string>(plan.lineItems.map((item) => item.workUnit));
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
        referencedWorkUnitIds.add(existing.workUnit);
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
        tagIds: item.tagIds?.length ? [...item.tagIds] : [],
        createdAt: syntheticTimestamp,
        updatedAt: syntheticTimestamp,
      });
      exportedWorkTypeIds.add(syntheticId);
      referencedWorkUnitIds.add(item.workUnit);
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

  const allWorkUnitDefinitions = await getAllWorkUnitDefinitions();
  const workUnitDefinitions = allWorkUnitDefinitions
    .filter((definition) => referencedWorkUnitIds.has(definition.id));

  // Collect all tag IDs referenced by exported workTypes and lineItems
  const referencedTagIds = new Set<string>();
  for (const wt of workTypes) {
    for (const tagId of wt.tagIds ?? []) referencedTagIds.add(tagId);
  }
  for (const item of remappedLineItems) {
    for (const tagId of item.tagIds ?? []) referencedTagIds.add(tagId);
  }

  let exportedTags: import('../../tags').Tag[] | undefined;
  let exportedTagCategories: import('../../tags').TagCategory[] | undefined;
  if (referencedTagIds.size > 0) {
    const allTags = await getAllTags();
    const allCategories = await getAllTagCategories();
    const filteredTags = allTags.filter((t) => referencedTagIds.has(t.id));
    const referencedCategoryIds = new Set(filteredTags.map((t) => t.categoryId));
    const filteredCategories = allCategories.filter((c) => referencedCategoryIds.has(c.id));
    exportedTags = filteredTags.length > 0 ? filteredTags : undefined;
    exportedTagCategories = filteredCategories.length > 0 ? filteredCategories : undefined;
  }

  return {
    plan: {
      ...plan,
      lineItems: remappedLineItems,
    },
    workTypes,
    workUnitDefinitions: workUnitDefinitions.length > 0 ? workUnitDefinitions : undefined,
    projects: projects.length > 0 ? projects : undefined,
    tags: exportedTags,
    tagCategories: exportedTagCategories,
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
  _planId: string,
  workTypes: WorkType[],
  tagIdRemap?: Map<string, string>,
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  for (const imported of workTypes) {
    // Any existing match (editable or readOnly phantom) — remap, no duplicate created.
    const existing = findWorkTypeByKey(imported.title, imported.workUnit);
    if (existing) {
      mapping.set(imported.id, existing.id);
      continue;
    }
    // Remap tag IDs if a tag remap table was provided (from the package's tag import).
    const remappedTagIds = imported.tagIds?.length
      ? imported.tagIds.map((id) => tagIdRemap?.get(id) ?? id)
      : undefined;
    // Genuinely new — create as a regular editable work type so it appears in the library.
    const created = await createWorkType({
      title: imported.title,
      workUnit: imported.workUnit,
      assemblyRate: imported.assemblyRate ?? 0,
      dismantleRate: imported.dismantleRate ?? 0,
      tagIds: remappedTagIds,
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
  const normalizedName = normalizeProjectName(importedProject.name);
  const match = existingProjects.find(
    (p) => normalizeProjectName(p.name) === normalizedName,
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

function shallowEqualPersonHoursByDate(
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
    if (!shallowEqualPersonHoursByDate(incomingItem.assemblyPersonHoursByDate, existingItem.assemblyPersonHoursByDate)) {
      changedFields.push('assemblyPersonHoursByDate');
    }
    if (!shallowEqualPersonHoursByDate(incomingItem.dismantlePersonHoursByDate, existingItem.dismantlePersonHoursByDate)) {
      changedFields.push('dismantlePersonHoursByDate');
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
    workUnitCount: envelope.payload.workUnitDefinitions?.length ?? 0,
    projectCount: envelope.payload.projects?.length ?? 0,
    tagCount: envelope.payload.tags?.length ?? 0,
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
  options: { applyLabelToExistingWorkUnits?: boolean } = {},
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

  const inferredUnits = new Map<string, string>();
  for (const lineItem of importedPlan.lineItems) {
    inferredUnits.set(lineItem.workUnit, lineItem.workUnit);
  }
  for (const workType of envelope.payload.workTypes) {
    inferredUnits.set(workType.workUnit, workType.workUnit);
  }
  const importedUnits = envelope.payload.workUnitDefinitions?.map((definition) => ({
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

  // Upsert tag categories and tags from the package into the local store.
  // Uses name-based deduplication: if a category/tag with the same normalized
  // name already exists locally, the package ID is remapped to the local ID
  // rather than creating a duplicate. This mirrors the resolveImportedWorkTypeIds
  // pattern and handles independent creation of the same tags on different devices.
  const categoryIdRemap = new Map<string, string>(); // packageId → localId
  const tagIdRemap = new Map<string, string>();       // packageId → localId

  if (envelope.payload.tagCategories?.length) {
    const existingCategories = await getAllTagCategories();
    for (const category of envelope.payload.tagCategories) {
      // 1. Exact ID match — already present, record identity
      if (existingCategories.some((c) => c.id === category.id)) {
        categoryIdRemap.set(category.id, category.id);
        continue;
      }
      // 2. Name match — remap to the existing local category, no insert
      const normalized = normalizeTagCategoryName(category.name);
      const existing = existingCategories.find(
        (c) => normalizeTagCategoryName(c.name) === normalized,
      );
      if (existing) {
        categoryIdRemap.set(category.id, existing.id);
        continue;
      }
      // 3. Genuinely new category — use store action to keep in-memory state in sync
      const created = await createTagCategory({ name: category.name });
      categoryIdRemap.set(category.id, created.id);
      existingCategories.push(created);
    }
  }

  if (envelope.payload.tags?.length) {
    const existingTags = await getAllTags();
    for (const tag of envelope.payload.tags) {
      // 1. Exact ID match — already present
      if (existingTags.some((t) => t.id === tag.id)) {
        tagIdRemap.set(tag.id, tag.id);
        continue;
      }
      // 2. Name match within the (possibly remapped) local category — remap, no insert
      const localCategoryId = categoryIdRemap.get(tag.categoryId) ?? tag.categoryId;
      const normalized = normalizeTagName(tag.name);
      const existing = existingTags.find(
        (t) => t.categoryId === localCategoryId && normalizeTagName(t.name) === normalized,
      );
      if (existing) {
        tagIdRemap.set(tag.id, existing.id);
        continue;
      }
      // 3. Genuinely new tag — use store action to keep in-memory state in sync
      const created = await createTag({
        categoryId: localCategoryId,
        name: tag.name,
        color: tag.color,
        sequencable: tag.sequencable,
      });
      tagIdRemap.set(tag.id, created.id);
      existingTags.push(created);
    }
  }

  const workTypeIdMap = await resolveImportedWorkTypeIds(importedPlan.id, envelope.payload.workTypes, tagIdRemap);
  const remappedLineItems = importedPlan.lineItems.map((item) => ({
    ...item,
    workTypeId: item.workTypeId ? (workTypeIdMap.get(item.workTypeId) ?? item.workTypeId) : null,
    // Remap tag IDs so the plan references local tags (handles ID divergence across devices)
    tagIds: item.tagIds?.map((id) => tagIdRemap.get(id) ?? id),
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
      await refreshProjectsInTaskStore();
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
    await refreshProjectsInTaskStore();
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

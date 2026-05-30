import {
  addTag,
  addTagCategory,
  addWorkType,
  addWorkUnitDefinitions,
  deleteAllTags,
  deleteAllTagCategories,
  deleteAllWorkTypes,
  deleteAllWorkUnitDefinitions,
  deleteCrewPool,
  deleteGlobalTagSequence,
  getAllPlans,
  getAllTags,
  getAllTagCategories,
  getAllTaskTemplates,
  getAllTasks,
  getAllWorkTypes,
  getAllWorkUnitDefinitions,
  getCrewPool,
  getGlobalTagSequence,
  putCrewPool,
  putGlobalTagSequence,
} from '../db';
import type { Plan } from '../planning/plan-model';
import type { CrewPool, GlobalTagSequence, Tag, TagCategory } from '../tags';
import type { Task, TaskTemplate, WorkType, WorkUnitDefinition } from '../types';
import { nowUtc } from '../types';
import { refreshCrewPoolStore } from '../stores/crew-pool-store';
import { refreshTagSequenceStore } from '../stores/tag-sequence-store';
import { refreshTagStore } from '../stores/tag-store';
import { refreshWorkTypeStore } from '../stores/work-type-store';
import { refreshWorkUnitStore } from '../stores/work-unit-store';
import { getSession, getSupabaseClient } from './supabase-client';

export { getSession, signIn, signOut, isSupabaseConfigured } from './supabase-client';

export const CATALOG_SCHEMA_VERSION = 'catalog-1.0';

export interface CatalogSnapshotPayload {
  snapshotFormatVersion: 1;
  exportedAt: string;
  workUnitDefinitions: WorkUnitDefinition[];
  workTypes: WorkType[];
  tagCategories: TagCategory[];
  tags: Tag[];
  globalTagSequence: GlobalTagSequence | null;
  crewPool: CrewPool | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
}

export interface CloudCatalogStatus {
  workspace: WorkspaceSummary;
  hasSnapshot: boolean;
  schemaVersion: string | null;
  catalogVersion: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  payload: CatalogSnapshotPayload | null;
}

export interface CatalogCounts {
  workUnitDefinitions: number;
  workTypes: number;
  tagCategories: number;
  tags: number;
  globalTagSequence: number;
  crewPool: number;
}

export interface CatalogPullPreview {
  payload: CatalogSnapshotPayload;
  counts: CatalogCounts;
  blocked: boolean;
  issues: CatalogPullIssue[];
}

export interface CatalogPullIssue {
  entity: 'workType' | 'workUnit' | 'tag' | 'tagCategory';
  id: string;
  label: string;
  references: CatalogReferenceCounts;
}

export interface CatalogReferenceCounts {
  tasks: number;
  plans: number;
  templates: number;
  readOnlyWorkTypes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseCatalogPayload(value: unknown): CatalogSnapshotPayload | null {
  if (!isRecord(value)) return null;
  if (value.snapshotFormatVersion !== 1) return null;
  if (!Array.isArray(value.workUnitDefinitions)) return null;
  if (!Array.isArray(value.workTypes)) return null;
  if (!Array.isArray(value.tagCategories)) return null;
  if (!Array.isArray(value.tags)) return null;
  if (value.globalTagSequence !== null && !isRecord(value.globalTagSequence)) return null;
  if (value.crewPool !== null && !isRecord(value.crewPool)) return null;
  return value as unknown as CatalogSnapshotPayload;
}

function countPayload(payload: CatalogSnapshotPayload): CatalogCounts {
  return {
    workUnitDefinitions: payload.workUnitDefinitions.length,
    workTypes: payload.workTypes.length,
    tagCategories: payload.tagCategories.length,
    tags: payload.tags.length,
    globalTagSequence: payload.globalTagSequence ? 1 : 0,
    crewPool: payload.crewPool ? 1 : 0,
  };
}

export async function buildLocalCatalogSnapshot(): Promise<CatalogSnapshotPayload> {
  const [
    workUnitDefinitions,
    workTypes,
    tagCategories,
    tags,
    globalTagSequence,
    crewPool,
  ] = await Promise.all([
    getAllWorkUnitDefinitions(),
    getAllWorkTypes(),
    getAllTagCategories(),
    getAllTags(),
    getGlobalTagSequence(),
    getCrewPool(),
  ]);

  return {
    snapshotFormatVersion: 1,
    exportedAt: nowUtc(),
    workUnitDefinitions,
    workTypes: workTypes.filter((workType) => workType.readOnly !== true),
    tagCategories,
    tags,
    globalTagSequence: globalTagSequence ?? null,
    crewPool: crewPool ?? null,
  };
}

function emptyRefs(): CatalogReferenceCounts {
  return { tasks: 0, plans: 0, templates: 0, readOnlyWorkTypes: 0 };
}

function addIssue(
  issues: CatalogPullIssue[],
  entity: CatalogPullIssue['entity'],
  id: string,
  label: string,
  references: CatalogReferenceCounts,
): void {
  if (
    references.tasks === 0 &&
    references.plans === 0 &&
    references.templates === 0 &&
    references.readOnlyWorkTypes === 0
  ) {
    return;
  }
  issues.push({ entity, id, label, references });
}

function countPlanWorkTypeRefs(plans: Plan[], id: string): number {
  return plans.reduce(
    (count, plan) => count + plan.lineItems.filter((item) => item.workTypeId === id).length,
    0,
  );
}

function countPlanWorkUnitRefs(plans: Plan[], id: string): number {
  return plans.reduce(
    (count, plan) => count + plan.lineItems.filter((item) => item.workUnit === id).length,
    0,
  );
}

function countPlanTagRefs(plans: Plan[], id: string): number {
  return plans.reduce(
    (count, plan) => count + plan.lineItems.filter((item) => item.tagIds?.includes(id)).length,
    0,
  );
}

function countTemplateUnitRefs(templates: TaskTemplate[], id: string): number {
  return templates.filter((template) => template.workUnit === id).length;
}

function countTemplateWorkTypeRefs(templates: TaskTemplate[], id: string): number {
  return templates.filter((template) => template.workTypeId === id).length;
}

function countTaskUnitRefs(tasks: Task[], id: string): number {
  return tasks.filter((task) => task.workUnit === id).length;
}

function countTaskWorkTypeRefs(tasks: Task[], id: string): number {
  return tasks.filter((task) => task.workTypeId === id).length;
}

function countTaskTagRefs(tasks: Task[], id: string): number {
  return tasks.filter((task) => task.additionalTagIds?.includes(id)).length;
}

function countReadOnlyWorkTypeTagRefs(workTypes: WorkType[], id: string): number {
  return workTypes.filter(
    (workType) =>
      workType.readOnly === true &&
      (workType.skillTagId === id || workType.tagIds?.includes(id)),
  ).length;
}

function countReadOnlyWorkTypeUnitRefs(workTypes: WorkType[], id: string): number {
  return workTypes.filter((workType) => workType.readOnly === true && workType.workUnit === id).length;
}

export async function previewCloudCatalogPull(
  payload: CatalogSnapshotPayload,
): Promise<CatalogPullPreview> {
  const [localWorkUnits, localWorkTypes, localTags, localCategories, tasks, templates, plans] =
    await Promise.all([
      getAllWorkUnitDefinitions(),
      getAllWorkTypes(),
      getAllTags(),
      getAllTagCategories(),
      getAllTasks(),
      getAllTaskTemplates(),
      getAllPlans(),
    ]);

  const incomingUnitIds = new Set(payload.workUnitDefinitions.map((item) => item.id));
  const incomingWorkTypeIds = new Set(payload.workTypes.map((item) => item.id));
  const incomingTagIds = new Set(payload.tags.map((item) => item.id));
  const incomingCategoryIds = new Set(payload.tagCategories.map((item) => item.id));
  const issues: CatalogPullIssue[] = [];

  for (const workType of localWorkTypes) {
    if (workType.readOnly === true || incomingWorkTypeIds.has(workType.id)) continue;
    addIssue(issues, 'workType', workType.id, workType.title, {
      ...emptyRefs(),
      tasks: countTaskWorkTypeRefs(tasks, workType.id),
      plans: countPlanWorkTypeRefs(plans, workType.id),
      templates: countTemplateWorkTypeRefs(templates, workType.id),
    });
  }

  for (const unit of localWorkUnits) {
    if (incomingUnitIds.has(unit.id)) continue;
    addIssue(issues, 'workUnit', unit.id, unit.label, {
      ...emptyRefs(),
      tasks: countTaskUnitRefs(tasks, unit.id),
      plans: countPlanWorkUnitRefs(plans, unit.id),
      templates: countTemplateUnitRefs(templates, unit.id),
      readOnlyWorkTypes: countReadOnlyWorkTypeUnitRefs(localWorkTypes, unit.id),
    });
  }

  for (const tag of localTags) {
    if (incomingTagIds.has(tag.id)) continue;
    addIssue(issues, 'tag', tag.id, tag.name, {
      ...emptyRefs(),
      tasks: countTaskTagRefs(tasks, tag.id),
      plans: countPlanTagRefs(plans, tag.id),
      readOnlyWorkTypes: countReadOnlyWorkTypeTagRefs(localWorkTypes, tag.id),
    });
  }

  for (const category of localCategories) {
    if (incomingCategoryIds.has(category.id)) continue;
    const removedReferencedTags = localTags.filter(
      (tag) => tag.categoryId === category.id && !incomingTagIds.has(tag.id),
    );
    addIssue(issues, 'tagCategory', category.id, category.name, {
      ...emptyRefs(),
      tasks: removedReferencedTags.reduce((sum, tag) => sum + countTaskTagRefs(tasks, tag.id), 0),
      plans: removedReferencedTags.reduce((sum, tag) => sum + countPlanTagRefs(plans, tag.id), 0),
      readOnlyWorkTypes: removedReferencedTags.reduce(
        (sum, tag) => sum + countReadOnlyWorkTypeTagRefs(localWorkTypes, tag.id),
        0,
      ),
    });
  }

  return {
    payload,
    counts: countPayload(payload),
    blocked: issues.length > 0,
    issues,
  };
}

async function refreshCatalogStores(): Promise<void> {
  await Promise.all([
    refreshWorkUnitStore(),
    refreshWorkTypeStore(),
    refreshTagStore(),
    refreshTagSequenceStore(),
    refreshCrewPoolStore(),
  ]);
}

export async function applyCloudCatalogPull(preview: CatalogPullPreview): Promise<void> {
  if (preview.blocked) {
    throw new Error('Cloud catalog pull is blocked because local records still reference setup items that would be removed.');
  }

  const existingWorkTypes = await getAllWorkTypes();
  const { payload } = preview;
  const incomingWorkTypeIds = new Set(payload.workTypes.map((workType) => workType.id));
  const readOnlyWorkTypes = existingWorkTypes.filter(
    (workType) => workType.readOnly === true && !incomingWorkTypeIds.has(workType.id),
  );

  await deleteAllWorkUnitDefinitions();
  await addWorkUnitDefinitions(payload.workUnitDefinitions);

  await deleteAllWorkTypes();
  for (const workType of [...payload.workTypes, ...readOnlyWorkTypes]) {
    await addWorkType(workType);
  }

  await deleteAllTags();
  await deleteAllTagCategories();
  for (const category of payload.tagCategories) {
    await addTagCategory(category);
  }
  for (const tag of payload.tags) {
    await addTag(tag);
  }

  await deleteGlobalTagSequence();
  if (payload.globalTagSequence) {
    await putGlobalTagSequence(payload.globalTagSequence);
  }

  await deleteCrewPool();
  if (payload.crewPool) {
    await putCrewPool(payload.crewPool);
  }

  await refreshCatalogStores();
}

async function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  const session = await getSession();
  if (!session) throw new Error('Sign in before using Cloud Sync.');
  return { supabase, session };
}

export async function ensureSingleWorkspace(): Promise<WorkspaceSummary> {
  const { supabase, session } = await requireSupabase();
  const userId = session.user.id;

  const membershipResult = await supabase
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) throw membershipResult.error;

  if (membershipResult.data?.workspace_id) {
    const workspaceResult = await supabase
      .from('workspaces')
      .select('id,name')
      .eq('id', membershipResult.data.workspace_id)
      .single();
    if (workspaceResult.error) throw workspaceResult.error;
    return {
      id: String(workspaceResult.data.id),
      name: String(workspaceResult.data.name),
    };
  }

  const workspaceResult = await supabase
    .from('workspaces')
    .insert({ name: 'My Workspace', created_by: userId })
    .select('id,name')
    .single();
  if (workspaceResult.error) throw workspaceResult.error;

  const workspace = workspaceResult.data;
  const membershipInsert = await supabase.from('workspace_memberships').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
  });
  if (membershipInsert.error) throw membershipInsert.error;

  return {
    id: String(workspace.id),
    name: String(workspace.name),
  };
}

export async function getCloudCatalogStatus(): Promise<CloudCatalogStatus> {
  const { supabase } = await requireSupabase();
  const workspace = await ensureSingleWorkspace();

  const snapshotResult = await supabase
    .from('workspace_catalog_snapshots')
    .select('schema_version,catalog_version,payload,updated_by,updated_at')
    .eq('workspace_id', workspace.id)
    .maybeSingle();
  if (snapshotResult.error) throw snapshotResult.error;

  const row = snapshotResult.data;
  const payload = row ? parseCatalogPayload(row.payload) : null;
  return {
    workspace,
    hasSnapshot: payload != null,
    schemaVersion: row ? asString(row.schema_version) : null,
    catalogVersion: row ? asString(row.catalog_version) : null,
    updatedAt: row ? asString(row.updated_at) : null,
    updatedBy: row ? asString(row.updated_by) : null,
    payload,
  };
}

export async function pushLocalCatalogSnapshot(): Promise<CloudCatalogStatus> {
  const { supabase, session } = await requireSupabase();
  const workspace = await ensureSingleWorkspace();
  const payload = await buildLocalCatalogSnapshot();
  const now = nowUtc();

  const upsertResult = await supabase.from('workspace_catalog_snapshots').upsert(
    {
      workspace_id: workspace.id,
      schema_version: CATALOG_SCHEMA_VERSION,
      catalog_version: payload.exportedAt,
      payload,
      updated_by: session.user.id,
      updated_at: now,
    },
    { onConflict: 'workspace_id' },
  );
  if (upsertResult.error) throw upsertResult.error;

  return getCloudCatalogStatus();
}

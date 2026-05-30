import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogSnapshotPayload } from './catalog-sync';
import type { CrewPool, GlobalTagSequence, Tag, TagCategory } from '../tags';
import type { Task, TaskTemplate, WorkType, WorkUnitDefinition } from '../types';
import type { Plan } from '../planning/plan-model';

const dbMocks = vi.hoisted(() => ({
  addTag: vi.fn(),
  addTagCategory: vi.fn(),
  addWorkType: vi.fn(),
  addWorkUnitDefinitions: vi.fn(),
  deleteAllTags: vi.fn(),
  deleteAllTagCategories: vi.fn(),
  deleteAllWorkTypes: vi.fn(),
  deleteAllWorkUnitDefinitions: vi.fn(),
  deleteCrewPool: vi.fn(),
  deleteGlobalTagSequence: vi.fn(),
  getAllPlans: vi.fn(),
  getAllTags: vi.fn(),
  getAllTagCategories: vi.fn(),
  getAllTaskTemplates: vi.fn(),
  getAllTasks: vi.fn(),
  getAllWorkTypes: vi.fn(),
  getAllWorkUnitDefinitions: vi.fn(),
  getCrewPool: vi.fn(),
  getGlobalTagSequence: vi.fn(),
  putCrewPool: vi.fn(),
  putGlobalTagSequence: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  refreshCrewPoolStore: vi.fn(),
  refreshTagSequenceStore: vi.fn(),
  refreshTagStore: vi.fn(),
  refreshWorkTypeStore: vi.fn(),
  refreshWorkUnitStore: vi.fn(),
}));

vi.mock('../db', () => dbMocks);
vi.mock('../stores/crew-pool-store', () => ({ refreshCrewPoolStore: storeMocks.refreshCrewPoolStore }));
vi.mock('../stores/tag-sequence-store', () => ({ refreshTagSequenceStore: storeMocks.refreshTagSequenceStore }));
vi.mock('../stores/tag-store', () => ({ refreshTagStore: storeMocks.refreshTagStore }));
vi.mock('../stores/work-type-store', () => ({ refreshWorkTypeStore: storeMocks.refreshWorkTypeStore }));
vi.mock('../stores/work-unit-store', () => ({ refreshWorkUnitStore: storeMocks.refreshWorkUnitStore }));
vi.mock('./supabase-client', () => ({
  getSession: vi.fn(),
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

function makeUnit(id = 'm2'): WorkUnitDefinition {
  return {
    id,
    label: id,
    sortIndex: 0,
    builtIn: id === 'm2',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet',
    workUnit: 'm2',
    assemblyRate: 1,
    dismantleRate: 1,
    tagIds: [],
    skillTagId: null,
    readOnly: false,
    importedForPlanId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCategory(overrides: Partial<TagCategory> = {}): TagCategory {
  return {
    id: 'cat-1',
    name: 'Area',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    categoryId: 'cat-1',
    name: 'Hall A',
    color: '#2563eb',
    sequencable: true,
    skillTag: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Install',
    status: 'active',
    projectId: null,
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 1,
    workUnit: 'm2',
    crew: 1,
    targetProductivity: null,
    phase: 'assembly',
    workTypeId: 'wt-1',
    additionalTagIds: ['tag-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Template',
    workTypeId: 'wt-1',
    workUnit: 'm2',
    workQuantity: 1,
    estimatedMinutes: null,
    crew: null,
    targetProductivity: null,
    phase: 'assembly',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(): Plan {
  return {
    id: 'plan-1',
    title: 'Plan',
    status: 'draft',
    lineItems: [
      {
        id: 'line-1',
        title: 'Install',
        workTypeTitle: 'Carpet',
        workTypeId: 'wt-1',
        workUnit: 'm2',
        workQuantity: 1,
        dismantleQuantity: null,
        tagIds: ['tag-1'],
        assemblyRate: 1,
        dismantleRate: 1,
        assemblyCrew: 1,
        dismantleCrew: 1,
        assemblyTimeHours: 1,
        dismantleTimeHours: 1,
        assemblyRateSource: 'manual',
        dismantleRateSource: 'manual',
        assemblyPersonHoursByDate: undefined,
        dismantlePersonHoursByDate: undefined,
        assemblyScheduledStart: null,
        assemblyScheduledEnd: null,
        assemblyOriginalScheduledStart: null,
        assemblyOriginalScheduledEnd: null,
        dismantleScheduledStart: null,
        dismantleScheduledEnd: null,
        dismantleOriginalScheduledStart: null,
        dismantleOriginalScheduledEnd: null,
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
        rationale: null,
        reviewNote: null,
        removedFromSource: false,
        amendmentNote: null,
        amendedAt: null,
      },
    ],
    projectId: null,
    eventStartDate: null,
    eventEndDate: null,
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    defaultCrewSize: null,
    defaultEfficiency: null,
    workCalendar: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
    lastExecutionReturnExportedAt: null,
  };
}

function makePayload(overrides: Partial<CatalogSnapshotPayload> = {}): CatalogSnapshotPayload {
  return {
    snapshotFormatVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    workUnitDefinitions: [makeUnit('m2')],
    workTypes: [makeWorkType()],
    tagCategories: [makeCategory()],
    tags: [makeTag()],
    globalTagSequence: { id: 'global', tagIds: ['tag-1'], updatedAt: '2026-01-01T00:00:00.000Z' },
    crewPool: { id: 'global', allocations: {}, dailyDeployments: {}, updatedAt: '2026-01-01T00:00:00.000Z' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  Object.values(dbMocks).forEach((mock) => mock.mockReset());
  Object.values(storeMocks).forEach((mock) => mock.mockReset());
  dbMocks.getAllWorkUnitDefinitions.mockResolvedValue([makeUnit('m2')]);
  dbMocks.getAllWorkTypes.mockResolvedValue([makeWorkType()]);
  dbMocks.getAllTagCategories.mockResolvedValue([makeCategory()]);
  dbMocks.getAllTags.mockResolvedValue([makeTag()]);
  dbMocks.getGlobalTagSequence.mockResolvedValue({ id: 'global', tagIds: ['tag-1'], updatedAt: '2026-01-01T00:00:00.000Z' } satisfies GlobalTagSequence);
  dbMocks.getCrewPool.mockResolvedValue({ id: 'global', allocations: {}, dailyDeployments: {}, updatedAt: '2026-01-01T00:00:00.000Z' } satisfies CrewPool);
  dbMocks.getAllTasks.mockResolvedValue([]);
  dbMocks.getAllTaskTemplates.mockResolvedValue([]);
  dbMocks.getAllPlans.mockResolvedValue([]);
});

describe('catalog-sync', () => {
  it('builds a local catalog snapshot and excludes imported read-only work types', async () => {
    const readOnly = makeWorkType({ id: 'wt-imported', readOnly: true, importedForPlanId: 'plan-1' });
    dbMocks.getAllWorkTypes.mockResolvedValue([makeWorkType(), readOnly]);
    const { buildLocalCatalogSnapshot } = await import('./catalog-sync');

    const snapshot = await buildLocalCatalogSnapshot();

    expect(snapshot.workTypes.map((workType) => workType.id)).toEqual(['wt-1']);
    expect(snapshot.workUnitDefinitions).toHaveLength(1);
    expect(snapshot.tags).toHaveLength(1);
  });

  it('blocks pull when cloud catalog removes locally referenced work type, unit, and tag ids', async () => {
    dbMocks.getAllTasks.mockResolvedValue([makeTask()]);
    dbMocks.getAllTaskTemplates.mockResolvedValue([makeTemplate()]);
    dbMocks.getAllPlans.mockResolvedValue([makePlan()]);
    const { previewCloudCatalogPull } = await import('./catalog-sync');

    const preview = await previewCloudCatalogPull(
      makePayload({
        workUnitDefinitions: [makeUnit('pcs')],
        workTypes: [],
        tagCategories: [makeCategory()],
        tags: [],
        globalTagSequence: null,
        crewPool: null,
      }),
    );

    expect(preview.blocked).toBe(true);
    expect(preview.issues.map((issue) => issue.entity)).toEqual(
      expect.arrayContaining(['workType', 'workUnit', 'tag']),
    );
  });

  it('applies a safe pull, replaces catalog stores, and preserves read-only work types', async () => {
    const readOnly = makeWorkType({ id: 'wt-imported', readOnly: true, importedForPlanId: 'plan-1' });
    dbMocks.getAllWorkTypes.mockResolvedValue([makeWorkType(), readOnly]);
    const { previewCloudCatalogPull, applyCloudCatalogPull } = await import('./catalog-sync');
    const payload = makePayload({
      workTypes: [makeWorkType({ id: 'wt-cloud', title: 'Cloud Carpet' })],
    });
    const preview = await previewCloudCatalogPull(payload);

    await applyCloudCatalogPull(preview);

    expect(dbMocks.deleteAllWorkUnitDefinitions).toHaveBeenCalledTimes(1);
    expect(dbMocks.addWorkUnitDefinitions).toHaveBeenCalledWith(payload.workUnitDefinitions);
    expect(dbMocks.deleteAllWorkTypes).toHaveBeenCalledTimes(1);
    expect(dbMocks.addWorkType).toHaveBeenCalledWith(payload.workTypes[0]);
    expect(dbMocks.addWorkType).toHaveBeenCalledWith(readOnly);
    expect(dbMocks.putGlobalTagSequence).toHaveBeenCalledWith(payload.globalTagSequence);
    expect(dbMocks.putCrewPool).toHaveBeenCalledWith(payload.crewPool);
    expect(storeMocks.refreshWorkTypeStore).toHaveBeenCalledTimes(1);
  });
});

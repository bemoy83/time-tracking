import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan, PlanLineItem } from '../../planning/plan-model';
import type { WorkType } from '../../types';
import { getAllWorkTypes, getProject } from '../../db';
import { nowUtc } from '../../types';
import { downloadJson } from '../download-json';
import { buildPlanPackagePayload, exportPlanPackage, parsePlanPackageJson } from './plan-package';

vi.mock('../../db', () => ({
  addPlan: vi.fn(),
  addProject: vi.fn(),
  getAllProjects: vi.fn(),
  getAllTasks: vi.fn(),
  getAllWorkTypes: vi.fn(),
  getPlan: vi.fn(),
  getProject: vi.fn(),
  updatePlan: vi.fn(),
}));

vi.mock('../../types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../types')>();
  return {
    ...actual,
    nowUtc: vi.fn(),
  };
});

vi.mock('../download-json', () => ({
  downloadJson: vi.fn(),
}));

const mockGetAllWorkTypes = vi.mocked(getAllWorkTypes);
const mockGetProject = vi.mocked(getProject);
const mockNowUtc = vi.mocked(nowUtc);
const mockDownloadJson = vi.mocked(downloadJson);

function makeLineItem(overrides: Partial<PlanLineItem> = {}): PlanLineItem {
  return {
    id: 'line-1',
    title: 'Install carpet',
    workTypeTitle: 'Carpet Tiles',
    workUnit: 'm2',
    workTypeId: 'wt-1',
    workQuantity: 100,
    dismantleQuantity: null,
    assemblyRate: 12.5,
    assemblyCrew: 2,
    assemblyTimeHours: 8,
    assemblyRateSource: 'manual',
    dismantleRate: 0,
    dismantleCrew: 0,
    dismantleTimeHours: 0,
    dismantleRateSource: 'manual',
    assemblyScheduledStart: null,
    assemblyScheduledEnd: null,
    assemblyOriginalScheduledStart: null,
    assemblyOriginalScheduledEnd: null,
    assemblyCrewByDate: undefined,
    dismantleScheduledStart: null,
    dismantleScheduledEnd: null,
    dismantleOriginalScheduledStart: null,
    dismantleOriginalScheduledEnd: null,
    dismantleCrewByDate: undefined,
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
    removedFromSource: false,
    amendmentNote: null,
    amendedAt: null,
    ...overrides,
  };
}

function makePlan(lineItems: PlanLineItem[]): Plan {
  return {
    id: 'plan-1',
    title: 'Spring Event',
    status: 'active',
    lineItems,
    projectId: 'project-1',
    eventStartDate: '2026-02-20',
    eventEndDate: '2026-02-21',
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    defaultCrewSize: 4,
    workCalendar: [],
    createdAt: '2026-02-18T00:00:00.000Z',
    updatedAt: '2026-02-20T15:00:00.000Z',
    activatedAt: '2026-02-19T00:00:00.000Z',
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
  };
}

describe('plan-package export', () => {
  beforeEach(() => {
    mockGetAllWorkTypes.mockReset();
    mockGetProject.mockReset();
    mockGetProject.mockResolvedValue(null);
    mockNowUtc.mockReset();
    mockDownloadJson.mockReset();
    mockNowUtc.mockReturnValue('2026-02-28T10:00:00.000Z');
  });

  it('builds payload with referenced existing work types only', async () => {
    const existing: WorkType = {
      id: 'wt-1',
      title: 'Carpet Tiles',
      workUnit: 'm2',
      assemblyRate: 10,
      dismantleRate: 0,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };

    mockGetAllWorkTypes.mockResolvedValue([
      existing,
      {
        ...existing,
        id: 'wt-2',
        title: 'Unreferenced',
      },
    ]);

    const plan = makePlan([
      makeLineItem({ id: 'line-1', workTypeId: 'wt-1' }),
      makeLineItem({ id: 'line-2', workTypeId: null, title: 'Ad-hoc' }),
    ]);

    const payload = await buildPlanPackagePayload(plan);

    expect(mockGetAllWorkTypes).toHaveBeenCalledTimes(1);
    expect(payload.workTypes).toEqual([existing]);
    expect(payload.plan.lineItems[0]).toMatchObject({
      id: 'line-1',
      workTypeId: 'wt-1',
      assemblyRate: 12.5,
    });
    expect(payload.plan.lineItems[1].workTypeId).toBeNull();
    expect(payload.lastModifiedAt).toBe(plan.updatedAt);
  });

  it('creates synthetic work types and remaps missing work type ids per line item', async () => {
    mockGetAllWorkTypes.mockResolvedValue([]);

    const plan = makePlan([
      makeLineItem({
        id: 'line-1',
        workTypeId: 'missing-id',
        workTypeTitle: 'Rigging',
        workUnit: 'm',
        assemblyRate: 5.5,
        dismantleRate: 0,
      }),
      makeLineItem({
        id: 'line-2',
        workTypeId: 'missing-id',
        workTypeTitle: 'Rigging Dismantle',
        workUnit: 'm',
        assemblyRate: 0,
        assemblyCrew: 0,
        assemblyTimeHours: 0,
        dismantleRate: 4.25,
        dismantleCrew: 1,
        dismantleTimeHours: 1,
      }),
    ]);

    const payload = await buildPlanPackagePayload(plan);

    expect(payload.plan.lineItems[0]).toMatchObject({
      id: 'line-1',
      workTypeId: 'plan-export-plan-1-line-1',
      assemblyRate: 5.5,
    });
    expect(payload.plan.lineItems[1]).toMatchObject({
      id: 'line-2',
      workTypeId: 'plan-export-plan-1-line-2',
      dismantleRate: 4.25,
    });
    expect(payload.workTypes).toEqual([
      {
        id: 'plan-export-plan-1-line-1',
        title: 'Rigging',
        workUnit: 'm',
        assemblyRate: 5.5,
        dismantleRate: 0,
        createdAt: '2026-02-28T10:00:00.000Z',
        updatedAt: '2026-02-28T10:00:00.000Z',
      },
      {
        id: 'plan-export-plan-1-line-2',
        title: 'Rigging Dismantle',
        workUnit: 'm',
        assemblyRate: 0,
        dismantleRate: 4.25,
        createdAt: '2026-02-28T10:00:00.000Z',
        updatedAt: '2026-02-28T10:00:00.000Z',
      },
    ]);
  });

  it('preserves dual-phase work packages in canonical export format', async () => {
    mockGetAllWorkTypes.mockResolvedValue([]);
    const plan = makePlan([
      makeLineItem({
        id: 'line-1',
        workTypeId: null,
        assemblyRate: 8,
        assemblyCrew: 3,
        assemblyTimeHours: 5,
        dismantleRate: 6,
        dismantleCrew: 2,
        dismantleTimeHours: 4,
      }),
    ]);

    const payload = await buildPlanPackagePayload(plan);

    expect(payload.plan.lineItems).toHaveLength(1);
    expect(payload.plan.lineItems[0]).toMatchObject({
      id: 'line-1',
      assemblyRate: 8,
      assemblyCrew: 3,
      assemblyTimeHours: 5,
      dismantleRate: 6,
      dismantleCrew: 2,
      dismantleTimeHours: 4,
    });
  });

  it('exports a JSON envelope with sanitized filename', async () => {
    const existing: WorkType = {
      id: 'wt-1',
      title: 'Carpet Tiles',
      workUnit: 'm2',
      assemblyRate: 10,
      dismantleRate: 0,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    mockGetAllWorkTypes.mockResolvedValue([existing]);

    const plan = {
      ...makePlan([makeLineItem({ id: 'line-1', workTypeId: 'wt-1' })]),
      title: ' Plan / Hall A ',
      updatedAt: '2026-02-24T18:30:00.000Z',
    };

    await exportPlanPackage(plan);

    expect(mockDownloadJson).toHaveBeenCalledTimes(1);
    const [filename, envelope] = mockDownloadJson.mock.calls[0];
    expect(filename).toBe('plan-package-plan-hall-a-2026-02-24.json');
    expect(envelope).toMatchObject({
      exportType: 'plan-package',
      payload: {
        lastModifiedAt: '2026-02-24T18:30:00.000Z',
        plan: {
          id: 'plan-1',
        },
      },
    });
  });

  it('includes project in payload when plan has projectId and project exists', async () => {
    const project = {
      id: 'project-1',
      name: 'Spring Exhibition',
      color: '#2563eb',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    mockGetProject.mockResolvedValue(project);
    mockGetAllWorkTypes.mockResolvedValue([]);

    const plan = makePlan([makeLineItem({ workTypeId: null })]);
    const payload = await buildPlanPackagePayload(plan);

    expect(mockGetProject).toHaveBeenCalledWith('project-1');
    expect(payload.projects).toEqual([project]);
  });

  it('omits projects when plan has no projectId', async () => {
    const plan = { ...makePlan([makeLineItem()]), projectId: null };
    mockGetAllWorkTypes.mockResolvedValue([]);

    const payload = await buildPlanPackagePayload(plan);

    expect(mockGetProject).not.toHaveBeenCalled();
    expect(payload.projects).toBeUndefined();
  });

  it('rejects legacy single-phase line item payloads', () => {
    const parsed = parsePlanPackageJson(JSON.stringify({
      schemaVersion: '2.0',
      exportType: 'plan-package',
      exportedAt: '2026-02-28T10:00:00.000Z',
      appVersion: '0.0.1',
      payload: {
        plan: {
          ...makePlan([]),
          lineItems: [
            {
              id: 'line-1',
              title: 'Install carpet',
              workTypeTitle: 'Carpet Tiles',
              workUnit: 'm2',
              workTypeId: null,
              workQuantity: 100,
              phase: 'assembly',
              productivityRate: 8,
              crew: 3,
              timeHours: 5,
              rateSource: 'manual',
            },
          ],
        },
        workTypes: [],
        lastModifiedAt: '2026-02-20T15:00:00.000Z',
      },
    }));

    expect(parsed).toEqual({
      ok: false,
      error: 'Invalid line item payload. Only canonical dual-phase line items are supported.',
    });
  });
});

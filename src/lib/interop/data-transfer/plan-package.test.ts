import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan, PlanLineItem } from '../../planning/plan-model';
import type { WorkType } from '../../types';
import { getAllWorkTypes, getProject } from '../../db';
import { nowUtc } from '../../types';
import { downloadJson } from '../download-json';
import { buildPlanPackagePayload, exportPlanPackage } from './plan-package';

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
    tearDownQuantity: null,
    buildUpRate: 12.5,
    buildUpCrew: 2,
    buildUpTimeHours: 8,
    buildUpRateSource: 'manual',
    tearDownRate: 0,
    tearDownCrew: 0,
    tearDownTimeHours: 0,
    tearDownRateSource: 'manual',
    buildUpScheduledStart: null,
    buildUpScheduledEnd: null,
    buildUpOriginalScheduledStart: null,
    buildUpOriginalScheduledEnd: null,
    buildUpCrewByDate: undefined,
    tearDownScheduledStart: null,
    tearDownScheduledEnd: null,
    tearDownOriginalScheduledStart: null,
    tearDownOriginalScheduledEnd: null,
    tearDownCrewByDate: undefined,
    buildUpExecutionStatus: 'pending',
    buildUpBlockReason: null,
    buildUpBlockCategory: null,
    buildUpExecutorNote: null,
    buildUpDeferredNote: null,
    tearDownExecutionStatus: 'pending',
    tearDownBlockReason: null,
    tearDownBlockCategory: null,
    tearDownExecutorNote: null,
    tearDownDeferredNote: null,
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
    buildUpStartDate: null,
    buildUpEndDate: null,
    tearDownStartDate: null,
    tearDownEndDate: null,
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
      buildUpRate: 10,
      tearDownRate: 0,
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
      id: 'line-1::phase::build-up',
      sourceWorkPackageId: 'line-1',
      workTypeId: 'wt-1',
      buildPhase: 'build-up',
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
        buildUpRate: 5.5,
        tearDownRate: 0,
      }),
      makeLineItem({
        id: 'line-2',
        workTypeId: 'missing-id',
        workTypeTitle: 'Rigging Tear-down',
        workUnit: 'm',
        buildUpRate: 0,
        buildUpCrew: 0,
        buildUpTimeHours: 0,
        tearDownRate: 4.25,
        tearDownCrew: 1,
        tearDownTimeHours: 1,
      }),
    ]);

    const payload = await buildPlanPackagePayload(plan);

    expect(payload.plan.lineItems[0]).toMatchObject({
      id: 'line-1::phase::build-up',
      sourceWorkPackageId: 'line-1',
      workTypeId: 'plan-export-plan-1-line-1',
      buildPhase: 'build-up',
    });
    expect(payload.plan.lineItems[1]).toMatchObject({
      id: 'line-2::phase::tear-down',
      sourceWorkPackageId: 'line-2',
      workTypeId: 'plan-export-plan-1-line-2',
      buildPhase: 'tear-down',
    });
    expect(payload.workTypes).toEqual([
      {
        id: 'plan-export-plan-1-line-1',
        title: 'Rigging',
        workUnit: 'm',
        buildUpRate: 5.5,
        tearDownRate: 0,
        createdAt: '2026-02-28T10:00:00.000Z',
        updatedAt: '2026-02-28T10:00:00.000Z',
      },
      {
        id: 'plan-export-plan-1-line-2',
        title: 'Rigging Tear-down',
        workUnit: 'm',
        buildUpRate: 0,
        tearDownRate: 4.25,
        createdAt: '2026-02-28T10:00:00.000Z',
        updatedAt: '2026-02-28T10:00:00.000Z',
      },
    ]);
  });

  it('splits a dual-phase work package into build-up and tear-down legacy records', async () => {
    mockGetAllWorkTypes.mockResolvedValue([]);
    const plan = makePlan([
      makeLineItem({
        id: 'line-1',
        workTypeId: null,
        buildUpRate: 8,
        buildUpCrew: 3,
        buildUpTimeHours: 5,
        tearDownRate: 6,
        tearDownCrew: 2,
        tearDownTimeHours: 4,
      }),
    ]);

    const payload = await buildPlanPackagePayload(plan);

    expect(payload.plan.lineItems).toHaveLength(2);
    expect(payload.plan.lineItems[0]).toMatchObject({
      id: 'line-1::phase::build-up',
      sourceWorkPackageId: 'line-1',
      buildPhase: 'build-up',
      productivityRate: 8,
      crew: 3,
      timeHours: 5,
    });
    expect(payload.plan.lineItems[1]).toMatchObject({
      id: 'line-1::phase::tear-down',
      sourceWorkPackageId: 'line-1',
      buildPhase: 'tear-down',
      productivityRate: 6,
      crew: 2,
      timeHours: 4,
    });
  });

  it('exports a JSON envelope with sanitized filename', async () => {
    const existing: WorkType = {
      id: 'wt-1',
      title: 'Carpet Tiles',
      workUnit: 'm2',
      buildUpRate: 10,
      tearDownRate: 0,
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
});

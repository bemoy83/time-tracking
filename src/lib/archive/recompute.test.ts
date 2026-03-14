import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task, WorkType } from '../types';
import { recomputeArchivedKpisByVersion } from './recompute';

vi.mock('../db', () => ({
  getAllTasks: vi.fn(),
  getAllWorkTypes: vi.fn(),
}));

vi.mock('../attributed-rollup', () => ({
  buildAttributedRollup: vi.fn(),
}));

vi.mock('../kpi', () => ({
  computeWorkTypeKpis: vi.fn(),
}));

import { getAllTasks, getAllWorkTypes } from '../db';
import { buildAttributedRollup } from '../attributed-rollup';
import { computeWorkTypeKpis } from '../kpi';

const mockGetAllTasks = vi.mocked(getAllTasks);
const mockGetAllWorkTypes = vi.mocked(getAllWorkTypes);
const mockBuildAttributedRollup = vi.mocked(buildAttributedRollup);
const mockComputeWorkTypeKpis = vi.mocked(computeWorkTypeKpis);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    crew: null,
    targetProductivity: null,
    buildPhase: 'assembly',
    workTypeId: 'wt-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: '2024-02-01T00:00:00.000Z',
    archiveVersion: 'v1',
    ...overrides,
  };
}

const WORK_TYPES: WorkType[] = [
  {
    id: 'wt-1',
    title: 'Carpet',
    workUnit: 'm2',
    assemblyRate: 10,
    dismantleRate: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllWorkTypes.mockResolvedValue(WORK_TYPES);
  mockBuildAttributedRollup.mockResolvedValue({
    entriesByTask: new Map(),
    summary: {
      engineVersion: 'v1',
      totalEntries: 0,
      attributed: 0,
      unattributed: 0,
      ambiguous: 0,
      totalPersonHours: 0,
      attributedPersonHours: 0,
      excludedPersonHours: 0,
      ambiguousSuggestedResolutions: 0,
      ambiguousResolvedByPolicy: 0,
    },
    allAttributed: [],
  });
  mockComputeWorkTypeKpis.mockImplementation((groupTasks) => {
    const first = (groupTasks as Task[])[0];
    if (!first) return [];
    return [{
      key: {
        workTypeId: 'wt-1',
        workTypeTitle: `group-${first.archiveVersion ?? 'unknown'}`,
        workUnit: 'm2',
      },
      sampleCount: 1,
      avgProductivity: 10,
      totalQuantity: 100,
      totalPersonHours: 10,
      confidence: 'insufficient',
      cv: null,
      outlierCount: 0,
    }];
  });
});

describe('recomputeArchivedKpisByVersion', () => {
  it('groups archived tasks by archiveVersion and recomputes per group', async () => {
    mockGetAllTasks.mockResolvedValue([
      makeTask({ id: 't-v1-a', archiveVersion: 'v1' }),
      makeTask({ id: 't-v2', archiveVersion: 'v2' }),
      makeTask({ id: 't-v1-b', archiveVersion: 'v1' }),
      makeTask({ id: 't-u', archiveVersion: null }),
      makeTask({ id: 't-active', archivedAt: null, archiveVersion: null, status: 'active' }),
    ]);

    const result = await recomputeArchivedKpisByVersion();

    expect(result.totalArchivedTasks).toBe(4);
    expect(result.groups.map((g) => g.archiveVersion)).toEqual(['unknown', 'v1', 'v2']);
    expect(result.groups.find((g) => g.archiveVersion === 'v1')?.taskCount).toBe(2);
    expect(mockBuildAttributedRollup).toHaveBeenCalledTimes(3);
    expect(mockComputeWorkTypeKpis).toHaveBeenCalledTimes(3);
  });

  it('filters to one archiveVersion when requested', async () => {
    mockGetAllTasks.mockResolvedValue([
      makeTask({ id: 't-v1', archiveVersion: 'v1' }),
      makeTask({ id: 't-v2', archiveVersion: 'v2' }),
    ]);

    const result = await recomputeArchivedKpisByVersion({ archiveVersion: 'v2' });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].archiveVersion).toBe('v2');
    expect(result.groups[0].taskCount).toBe(1);
  });
});

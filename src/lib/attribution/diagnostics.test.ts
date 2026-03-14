import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttributedEntry, AttributionSummary, Task } from '../types';
import type { IssueQueueResult } from '../remediation/issue-queue';
import type { DataQualityProgress } from '../remediation/data-quality';
import { loadAttributionDiagnostics } from './diagnostics';

vi.mock('./cache', () => ({
  getCachedAttribution: vi.fn(),
  recomputeAttribution: vi.fn(),
}));

vi.mock('../remediation/issue-queue', () => ({
  buildIssueQueues: vi.fn(),
}));

vi.mock('../remediation/data-quality', () => ({
  computeDataQualityProgress: vi.fn(),
}));

import { getCachedAttribution, recomputeAttribution } from './cache';
import { buildIssueQueues } from '../remediation/issue-queue';
import { computeDataQualityProgress } from '../remediation/data-quality';

const mockGetCachedAttribution = vi.mocked(getCachedAttribution);
const mockRecomputeAttribution = vi.mocked(recomputeAttribution);
const mockBuildIssueQueues = vi.mocked(buildIssueQueues);
const mockComputeDataQualityProgress = vi.mocked(computeDataQualityProgress);

const sampleResults: AttributedEntry[] = [
  {
    entryId: 'e1',
    taskId: 't1',
    ownerTaskId: 't1',
    status: 'attributed',
    reason: 'self',
    durationMs: 3_600_000,
    personHours: 2,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
  },
];

const sampleSummary: AttributionSummary = {
  engineVersion: 'v1',
  totalEntries: 1,
  attributed: 1,
  unattributed: 0,
  ambiguous: 0,
  totalPersonHours: 2,
  attributedPersonHours: 2,
  excludedPersonHours: 0,
  ambiguousSuggestedResolutions: 0,
  ambiguousResolvedByPolicy: 0,
};

const sampleQueues: IssueQueueResult = {
  needsMeasurableOwner: [],
  ambiguousOwner: [],
  noWorkContext: [],
  totalIssues: 0,
  totalAffectedHours: 0,
};

const sampleProgress: DataQualityProgress = {
  attributionRate: 100,
  totalEntries: 1,
  attributedHours: 2,
  excludedHours: 0,
  issuesByCategory: {
    needsMeasurableOwner: 0,
    ambiguousOwner: 0,
    noWorkContext: 0,
  },
  totalOpenIssues: 0,
  affectedHours: 0,
  grade: 'excellent',
};

const sampleTasks: Task[] = [
  {
    id: 't1',
    title: 'Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 1,
    workUnit: 'm2',
    crew: null,
    targetProductivity: null,
    phase: 'assembly',
    workTypeId: 'wt-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCachedAttribution.mockResolvedValue({
    results: sampleResults,
    summary: sampleSummary,
    computedAt: '2024-01-01T00:00:00.000Z',
    source: 'cache',
  });
  mockRecomputeAttribution.mockResolvedValue({
    results: sampleResults,
    summary: sampleSummary,
    computedAt: '2024-01-02T00:00:00.000Z',
    source: 'recomputed',
  });
  mockBuildIssueQueues.mockReturnValue(sampleQueues);
  mockComputeDataQualityProgress.mockReturnValue(sampleProgress);
});

describe('loadAttributionDiagnostics', () => {
  it('loads from cache by default', async () => {
    const result = await loadAttributionDiagnostics({ tasks: sampleTasks });

    expect(mockGetCachedAttribution).toHaveBeenCalledWith('soft_allow_flag');
    expect(mockRecomputeAttribution).not.toHaveBeenCalled();
    expect(mockBuildIssueQueues).toHaveBeenCalledWith(sampleResults, sampleTasks);
    expect(result.source).toBe('cache');
  });

  it('forces recompute when requested', async () => {
    const result = await loadAttributionDiagnostics({
      tasks: sampleTasks,
      policy: 'strict_block',
      forceRecompute: true,
    });

    expect(mockRecomputeAttribution).toHaveBeenCalledWith('strict_block');
    expect(mockGetCachedAttribution).not.toHaveBeenCalled();
    expect(result.source).toBe('recomputed');
  });

  it('passes selected policy to cache path', async () => {
    await loadAttributionDiagnostics({
      tasks: sampleTasks,
      policy: 'soft_allow_pick_nearest',
    });

    expect(mockGetCachedAttribution).toHaveBeenCalledWith('soft_allow_pick_nearest');
  });

  it('returns consistent diagnostics payload', async () => {
    const result = await loadAttributionDiagnostics({ tasks: sampleTasks });

    expect(result.summary).toEqual(sampleSummary);
    expect(result.queues).toEqual(sampleQueues);
    expect(result.progress).toEqual(sampleProgress);
    expect(result.policy).toBe('soft_allow_flag');
    expect(result.computedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('throws when diagnostics loading fails', async () => {
    mockGetCachedAttribution.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(loadAttributionDiagnostics({ tasks: sampleTasks }))
      .rejects
      .toThrow('db unavailable');
  });
});

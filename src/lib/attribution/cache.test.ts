import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttributedEntry, AttributionSummary } from '../types';
import { getCachedAttribution, recomputeAttribution } from './cache';

vi.mock('../db', () => ({
  getAllTimeEntries: vi.fn(),
  getAllTasks: vi.fn(),
  getAttributionSnapshot: vi.fn(),
  setAttributionSnapshot: vi.fn(),
  clearAttributionSnapshots: vi.fn(),
}));

vi.mock('./engine', () => ({
  attributeEntries: vi.fn(),
}));

import {
  getAllTimeEntries,
  getAllTasks,
  getAttributionSnapshot,
  setAttributionSnapshot,
} from '../db';
import { attributeEntries } from './engine';

const mockGetAllTimeEntries = vi.mocked(getAllTimeEntries);
const mockGetAllTasks = vi.mocked(getAllTasks);
const mockGetAttributionSnapshot = vi.mocked(getAttributionSnapshot);
const mockSetAttributionSnapshot = vi.mocked(setAttributionSnapshot);
const mockAttributeEntries = vi.mocked(attributeEntries);

const summary: AttributionSummary = {
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

const results: AttributedEntry[] = [
  {
    entryId: 'e1',
    taskId: 't1',
    ownerTaskId: 't1',
    status: 'attributed',
    reason: 'self',
    personHours: 2,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllTimeEntries.mockResolvedValue([]);
  mockGetAllTasks.mockResolvedValue([]);
  mockAttributeEntries.mockReturnValue({ results, summary });
  mockSetAttributionSnapshot.mockResolvedValue(undefined);
});

describe('getCachedAttribution', () => {
  it('returns fresh valid cache without recompute', async () => {
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: new Date().toISOString(),
    });

    const response = await getCachedAttribution();

    expect(response.source).toBe('cache');
    expect(response.results).toEqual(results);
    expect(mockAttributeEntries).not.toHaveBeenCalled();
  });

  it('recomputes when snapshot payload is invalid', async () => {
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      // invalid: results must be an array
      results: null,
      summary,
      computedAt: new Date().toISOString(),
    } as never);

    const response = await getCachedAttribution();

    expect(response.source).toBe('recomputed');
    expect(mockAttributeEntries).toHaveBeenCalledOnce();
  });

  it('falls back to recompute when cache read throws', async () => {
    mockGetAttributionSnapshot.mockRejectedValue(new Error('cache read failed'));

    const response = await getCachedAttribution();

    expect(response.source).toBe('recomputed');
    expect(mockAttributeEntries).toHaveBeenCalledOnce();
  });

  it('surfaces terminal error when both cache and recompute fail', async () => {
    mockGetAttributionSnapshot.mockRejectedValue(new Error('cache read failed'));
    mockGetAllTimeEntries.mockRejectedValue(new Error('db unavailable'));

    await expect(getCachedAttribution()).rejects.toThrow('db unavailable');
  });
});

describe('recomputeAttribution', () => {
  it('returns recomputed metadata and writes snapshot', async () => {
    const response = await recomputeAttribution('soft_allow_flag');

    expect(response.source).toBe('recomputed');
    expect(response.computedAt).toBeTruthy();
    expect(mockSetAttributionSnapshot).toHaveBeenCalledOnce();
  });

  it('still returns recomputed results when cache persistence fails', async () => {
    mockSetAttributionSnapshot.mockRejectedValue(new Error('quota exceeded'));

    const response = await recomputeAttribution('soft_allow_flag');

    expect(response.source).toBe('recomputed');
    expect(response.results).toEqual(results);
    expect(response.summary).toEqual(summary);
  });
});

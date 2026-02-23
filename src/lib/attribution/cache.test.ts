import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttributedEntry, AttributionSummary } from '../types';
import { getCachedAttribution, getCachedAttributionWithBackgroundRefresh, isBackgroundRefreshInFlight, recomputeAttribution } from './cache';

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

describe('getCachedAttributionWithBackgroundRefresh', () => {
  it('returns fresh cache without triggering background refresh', async () => {
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: new Date().toISOString(),
    });

    const onRefresh = vi.fn();
    const response = await getCachedAttributionWithBackgroundRefresh('soft_allow_flag', onRefresh);

    expect(response.source).toBe('cache');
    expect(mockAttributeEntries).not.toHaveBeenCalled();
    // Wait a tick to ensure no background work fires
    await vi.waitFor(() => expect(onRefresh).not.toHaveBeenCalled());
  });

  it('returns stale cache immediately and fires background refresh', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: twoDaysAgo,
    });

    const onRefresh = vi.fn();
    const response = await getCachedAttributionWithBackgroundRefresh('soft_allow_flag', onRefresh);

    expect(response.source).toBe('stale-cache');
    expect(response.computedAt).toBe(twoDaysAgo);

    // Background refresh should fire and call back
    await vi.waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(onRefresh.mock.calls[0][0].source).toBe('recomputed');
  });

  it('falls back to full recompute when cache is too old (>7d)', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: tenDaysAgo,
    });

    const response = await getCachedAttributionWithBackgroundRefresh('soft_allow_flag');

    expect(response.source).toBe('recomputed');
  });

  it('falls back to recompute when no cache exists', async () => {
    mockGetAttributionSnapshot.mockResolvedValue(null);

    const response = await getCachedAttributionWithBackgroundRefresh('soft_allow_flag');

    expect(response.source).toBe('recomputed');
  });

  it('deduplicates concurrent background refreshes for same policy', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: twoDaysAgo,
    });

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    await getCachedAttributionWithBackgroundRefresh('soft_allow_flag', cb1);
    await getCachedAttributionWithBackgroundRefresh('soft_allow_flag', cb2);

    await vi.waitFor(() => {
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    // Engine should only have been called once (deduplicated)
    expect(mockAttributeEntries).toHaveBeenCalledOnce();
  });

  it('does not fire callback when background refresh fails', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAttributionSnapshot.mockResolvedValue({
      id: 'soft_allow_flag',
      policy: 'soft_allow_flag',
      results,
      summary,
      computedAt: twoDaysAgo,
    });
    mockGetAllTimeEntries.mockRejectedValue(new Error('db unavailable'));

    const onRefresh = vi.fn();
    const response = await getCachedAttributionWithBackgroundRefresh('soft_allow_flag', onRefresh);

    expect(response.source).toBe('stale-cache');
    // Wait and confirm callback was never called
    await new Promise((r) => setTimeout(r, 50));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe('isBackgroundRefreshInFlight', () => {
  it('returns false when no refresh is in progress', () => {
    expect(isBackgroundRefreshInFlight('soft_allow_flag')).toBe(false);
  });
});

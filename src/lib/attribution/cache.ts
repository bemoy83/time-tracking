/**
 * Attribution snapshot cache — persists attribution results to IndexedDB
 * and provides freshness-aware retrieval.
 */

import type { AttributionPolicy, AttributionSnapshot, AttributedEntry, AttributionSummary } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY, nowUtc } from '../types';
import { getAllTimeEntries, getAllTasks, getAttributionSnapshot, setAttributionSnapshot, clearAttributionSnapshots } from '../db';
import { attributeEntries } from './engine';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached attribution if fresh (<24h, same policy), otherwise recompute.
 */
export async function getCachedAttribution(
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<{ results: AttributedEntry[]; summary: AttributionSummary }> {
  const snapshot = await getAttributionSnapshot(policy);

  if (snapshot) {
    const age = Date.now() - new Date(snapshot.computedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return { results: snapshot.results, summary: snapshot.summary };
    }
  }

  return recomputeAttribution(policy);
}

/**
 * Force recompute attribution and save snapshot to DB.
 */
export async function recomputeAttribution(
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<{ results: AttributedEntry[]; summary: AttributionSummary }> {
  const [entries, tasks] = await Promise.all([getAllTimeEntries(), getAllTasks()]);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const { results, summary } = attributeEntries(entries, taskMap, policy);

  const snapshot: AttributionSnapshot = {
    id: policy,
    results,
    summary,
    policy,
    computedAt: nowUtc(),
  };

  await setAttributionSnapshot(snapshot);

  return { results, summary };
}

/**
 * Invalidate all cached attribution snapshots.
 */
export async function invalidateAttributionCache(): Promise<void> {
  await clearAttributionSnapshots();
}

/**
 * Attribution snapshot cache — persists attribution results to IndexedDB
 * and provides freshness-aware retrieval with background refresh support.
 */

import type { AttributionPolicy, AttributionSnapshot, AttributedEntry, AttributionSummary } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY, nowUtc } from '../types';
import { getAllTimeEntries, getAllTasks, getAttributionSnapshot, setAttributionSnapshot, clearAttributionSnapshots } from '../db';
import { attributeEntries } from './engine';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STALE_SERVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — max age for stale-while-revalidate
const VALID_STATUSES = new Set(['attributed', 'unattributed', 'ambiguous']);
const VALID_REASONS = new Set(['self', 'ancestor', 'policySuggestedOwner', 'noMeasurableOwner', 'multipleOwners']);

export interface CachedAttributionResult {
  results: AttributedEntry[];
  summary: AttributionSummary;
  computedAt: string;
  source: 'cache' | 'recomputed' | 'stale-cache';
}

export type BackgroundRefreshCallback = (result: CachedAttributionResult) => void;

// In-flight background refresh promises keyed by policy to prevent duplicate work.
const inflightRefreshes = new Map<string, Promise<CachedAttributionResult>>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function isValidAttributedEntry(value: unknown): value is AttributedEntry {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.entryId === 'string' &&
    typeof candidate.taskId === 'string' &&
    (typeof candidate.ownerTaskId === 'string' || candidate.ownerTaskId == null) &&
    typeof candidate.status === 'string' &&
    VALID_STATUSES.has(candidate.status) &&
    typeof candidate.reason === 'string' &&
    VALID_REASONS.has(candidate.reason) &&
    isFiniteNumber(candidate.durationMs) &&
    isFiniteNumber(candidate.personHours) &&
    (typeof candidate.suggestedOwnerTaskId === 'string' || candidate.suggestedOwnerTaskId == null) &&
    (typeof candidate.heuristicUsed === 'string' || candidate.heuristicUsed == null)
  );
}

function isValidAttributionSummary(value: unknown): value is AttributionSummary {
  if (value == null || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return (
    typeof summary.engineVersion === 'string' &&
    isFiniteNumber(summary.totalEntries) &&
    isFiniteNumber(summary.attributed) &&
    isFiniteNumber(summary.unattributed) &&
    isFiniteNumber(summary.ambiguous) &&
    isFiniteNumber(summary.totalPersonHours) &&
    isFiniteNumber(summary.attributedPersonHours) &&
    isFiniteNumber(summary.excludedPersonHours) &&
    isFiniteNumber(summary.ambiguousSuggestedResolutions) &&
    isFiniteNumber(summary.ambiguousResolvedByPolicy)
  );
}

function isValidSnapshot(
  snapshot: AttributionSnapshot | null,
  policy: AttributionPolicy,
): snapshot is AttributionSnapshot {
  if (!snapshot) return false;
  if (snapshot.policy !== policy || snapshot.id !== policy) return false;
  if (!Array.isArray(snapshot.results) || !snapshot.results.every(isValidAttributedEntry)) return false;
  if (!isValidAttributionSummary(snapshot.summary)) return false;
  if (!isIsoTimestamp(snapshot.computedAt)) return false;
  return true;
}

function snapshotAge(snapshot: AttributionSnapshot): number {
  return Date.now() - new Date(snapshot.computedAt).getTime();
}

function isFreshSnapshot(snapshot: AttributionSnapshot): boolean {
  return snapshotAge(snapshot) < CACHE_TTL_MS;
}

function isStaleServeable(snapshot: AttributionSnapshot): boolean {
  const age = snapshotAge(snapshot);
  return age >= CACHE_TTL_MS && age < STALE_SERVE_TTL_MS;
}

function toResult(
  payload: { results: AttributedEntry[]; summary: AttributionSummary; computedAt: string },
  source: CachedAttributionResult['source'],
): CachedAttributionResult {
  return {
    results: payload.results,
    summary: payload.summary,
    computedAt: payload.computedAt,
    source,
  };
}

/**
 * Get cached attribution if fresh (<24h, same policy), otherwise recompute.
 */
export async function getCachedAttribution(
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<CachedAttributionResult> {
  try {
    const snapshot = await getAttributionSnapshot(policy);
    if (isValidSnapshot(snapshot, policy) && isFreshSnapshot(snapshot)) {
      return toResult(snapshot, 'cache');
    }
  } catch {
    // Fall back to recompute below.
  }

  return recomputeAttribution(policy);
}

/**
 * Force recompute attribution and save snapshot to DB.
 */
export async function recomputeAttribution(
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<CachedAttributionResult> {
  const [entries, tasks] = await Promise.all([getAllTimeEntries(), getAllTasks()]);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const { results, summary } = attributeEntries(entries, taskMap, policy);
  const computedAt = nowUtc();

  const snapshot: AttributionSnapshot = {
    id: policy,
    results,
    summary,
    policy,
    computedAt,
  };

  // Cache writes are best-effort. Remediation must still work even if
  // snapshot persistence fails (e.g. quota/store issues).
  try {
    await setAttributionSnapshot(snapshot);
  } catch {
    // Intentionally ignore cache persistence errors.
  }

  return toResult({ results, summary, computedAt }, 'recomputed');
}

/**
 * Get attribution with stale-while-revalidate semantics for large datasets.
 *
 * - Fresh cache → return immediately (source: 'cache').
 * - Stale but valid cache (<7d) → return stale data immediately (source: 'stale-cache')
 *   and trigger background recompute. When done, `onRefreshComplete` fires.
 * - No usable cache → full recompute (source: 'recomputed').
 *
 * Background refreshes are deduplicated per policy.
 */
export async function getCachedAttributionWithBackgroundRefresh(
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
  onRefreshComplete?: BackgroundRefreshCallback,
): Promise<CachedAttributionResult> {
  try {
    const snapshot = await getAttributionSnapshot(policy);
    if (isValidSnapshot(snapshot, policy)) {
      if (isFreshSnapshot(snapshot)) {
        return toResult(snapshot, 'cache');
      }
      if (isStaleServeable(snapshot)) {
        scheduleBackgroundRefresh(policy, onRefreshComplete);
        return toResult(snapshot, 'stale-cache');
      }
    }
  } catch {
    // Fall back to recompute below.
  }

  return recomputeAttribution(policy);
}

function scheduleBackgroundRefresh(
  policy: AttributionPolicy,
  onComplete?: BackgroundRefreshCallback,
): void {
  if (inflightRefreshes.has(policy)) {
    // Already refreshing — attach callback to existing promise if provided.
    if (onComplete) {
      inflightRefreshes.get(policy)!.then(onComplete).catch(() => {});
    }
    return;
  }

  const refreshPromise = recomputeAttribution(policy);
  inflightRefreshes.set(policy, refreshPromise);

  refreshPromise
    .then((result) => {
      onComplete?.(result);
    })
    .catch(() => {
      // Background refresh failures are non-fatal; stale data was already served.
    })
    .finally(() => {
      inflightRefreshes.delete(policy);
    });
}

/**
 * Check whether a background refresh is currently in flight for a given policy.
 */
export function isBackgroundRefreshInFlight(policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY): boolean {
  return inflightRefreshes.has(policy);
}

/**
 * Invalidate all cached attribution snapshots.
 */
export async function invalidateAttributionCache(): Promise<void> {
  await clearAttributionSnapshots();
}

/**
 * Attribution snapshot cache — persists attribution results to IndexedDB
 * and provides freshness-aware retrieval.
 */

import type { AttributionPolicy, AttributionSnapshot, AttributedEntry, AttributionSummary } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY, nowUtc } from '../types';
import { getAllTimeEntries, getAllTasks, getAttributionSnapshot, setAttributionSnapshot, clearAttributionSnapshots } from '../db';
import { attributeEntries } from './engine';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VALID_STATUSES = new Set(['attributed', 'unattributed', 'ambiguous']);
const VALID_REASONS = new Set(['self', 'ancestor', 'policySuggestedOwner', 'noMeasurableOwner', 'multipleOwners']);

export interface CachedAttributionResult {
  results: AttributedEntry[];
  summary: AttributionSummary;
  computedAt: string;
  source: 'cache' | 'recomputed';
}

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

function isFreshSnapshot(snapshot: AttributionSnapshot): boolean {
  const age = Date.now() - new Date(snapshot.computedAt).getTime();
  return age < CACHE_TTL_MS;
}

function toResult(
  payload: { results: AttributedEntry[]; summary: AttributionSummary; computedAt: string },
  source: 'cache' | 'recomputed',
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
 * Invalidate all cached attribution snapshots.
 */
export async function invalidateAttributionCache(): Promise<void> {
  await clearAttributionSnapshots();
}

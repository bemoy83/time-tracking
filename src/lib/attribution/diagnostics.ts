/**
 * Shared attribution diagnostics loader used by Attribution and Remediation views.
 */

import type { AttributionPolicy, AttributionSummary, Task } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY } from '../types';
import { getCachedAttribution, getCachedAttributionWithBackgroundRefresh, recomputeAttribution, type BackgroundRefreshCallback, type CachedAttributionResult } from './cache';
import { buildIssueQueues, type IssueQueueResult } from '../remediation/issue-queue';
import { computeDataQualityProgress, type DataQualityProgress } from '../remediation/data-quality';

export interface AttributionDiagnostics {
  policy: AttributionPolicy;
  computedAt: string;
  source: 'cache' | 'recomputed' | 'stale-cache';
  summary: AttributionSummary;
  queues: IssueQueueResult;
  progress: DataQualityProgress;
}

export interface LoadAttributionDiagnosticsOptions {
  tasks: Task[];
  policy?: AttributionPolicy;
  forceRecompute?: boolean;
  /** Enable stale-while-revalidate for large datasets. */
  backgroundRefresh?: boolean;
  /** Called when background refresh completes (only when backgroundRefresh=true and stale data was served). */
  onRefreshComplete?: (diagnostics: AttributionDiagnostics) => void;
}

function buildDiagnostics(
  policy: AttributionPolicy,
  attribution: CachedAttributionResult,
  tasks: Task[],
): AttributionDiagnostics {
  const queues = buildIssueQueues(attribution.results, tasks);
  const progress = computeDataQualityProgress(attribution.summary, queues);
  return {
    policy,
    computedAt: attribution.computedAt,
    source: attribution.source,
    summary: attribution.summary,
    queues,
    progress,
  };
}

export async function loadAttributionDiagnostics(
  options: LoadAttributionDiagnosticsOptions,
): Promise<AttributionDiagnostics> {
  const policy = options.policy ?? DEFAULT_ATTRIBUTION_POLICY;

  let attribution: CachedAttributionResult;
  if (options.forceRecompute) {
    attribution = await recomputeAttribution(policy);
  } else if (options.backgroundRefresh) {
    const refreshCallback: BackgroundRefreshCallback | undefined =
      options.onRefreshComplete
        ? (result) => options.onRefreshComplete!(buildDiagnostics(policy, result, options.tasks))
        : undefined;
    attribution = await getCachedAttributionWithBackgroundRefresh(policy, refreshCallback);
  } else {
    attribution = await getCachedAttribution(policy);
  }

  return buildDiagnostics(policy, attribution, options.tasks);
}

/**
 * Shared attribution diagnostics loader used by Attribution and Remediation views.
 */

import type { AttributionPolicy, AttributionSummary, Task } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY } from '../types';
import { getCachedAttribution, recomputeAttribution } from './cache';
import { buildIssueQueues, type IssueQueueResult } from '../remediation/issue-queue';
import { computeDataQualityProgress, type DataQualityProgress } from '../remediation/data-quality';

export interface AttributionDiagnostics {
  policy: AttributionPolicy;
  computedAt: string;
  source: 'cache' | 'recomputed';
  summary: AttributionSummary;
  queues: IssueQueueResult;
  progress: DataQualityProgress;
}

export interface LoadAttributionDiagnosticsOptions {
  tasks: Task[];
  policy?: AttributionPolicy;
  forceRecompute?: boolean;
}

export async function loadAttributionDiagnostics(
  options: LoadAttributionDiagnosticsOptions,
): Promise<AttributionDiagnostics> {
  const policy = options.policy ?? DEFAULT_ATTRIBUTION_POLICY;
  const attribution = options.forceRecompute
    ? await recomputeAttribution(policy)
    : await getCachedAttribution(policy);

  const queues = buildIssueQueues(attribution.results, options.tasks);
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

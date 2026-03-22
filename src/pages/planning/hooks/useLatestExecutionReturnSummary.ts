import { useEffect, useMemo, useState } from 'react';
import {
  getLatestExecutionReturnSummaryByPlanId,
  getLatestExecutionReturnSummariesByPlanIds,
  type LatestExecutionReturnSummaryByPlan,
} from '../../../lib/db';
import { subscribeToExecutionReturnImported } from '../../../lib/planning/execution-return-import-events';

export function useLatestExecutionReturnSummary(
  planId: string | null,
): LatestExecutionReturnSummaryByPlan | null {
  const [summary, setSummary] = useState<LatestExecutionReturnSummaryByPlan | null>(null);

  useEffect(() => {
    if (!planId) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    const load = () => {
      getLatestExecutionReturnSummaryByPlanId(planId).then((nextSummary) => {
        if (!cancelled) {
          setSummary(nextSummary);
        }
      });
    };

    load();
    const unsubscribe = subscribeToExecutionReturnImported(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [planId]);

  return summary;
}

export function useLatestExecutionReturnSummaries(
  planIds: string[],
): Map<string, LatestExecutionReturnSummaryByPlan> {
  const [summaries, setSummaries] = useState<Map<string, LatestExecutionReturnSummaryByPlan>>(new Map());
  const planIdsKey = useMemo(() => [...planIds].sort().join('|'), [planIds]);
  const stablePlanIds = useMemo(() => [...planIds], [planIdsKey]);

  useEffect(() => {
    if (stablePlanIds.length === 0) {
      setSummaries(new Map());
      return;
    }

    let cancelled = false;
    const load = () => {
      getLatestExecutionReturnSummariesByPlanIds(stablePlanIds).then((nextSummaries) => {
        if (!cancelled) {
          setSummaries(nextSummaries);
        }
      });
    };

    load();
    const unsubscribe = subscribeToExecutionReturnImported(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [planIdsKey, stablePlanIds]);

  return summaries;
}

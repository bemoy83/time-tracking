/**
 * KpiSection — displays productivity KPIs grouped by Work Type.
 * Renders inside SettingsView.
 */

import { useState, useEffect } from 'react';
import {
  Task,
  WORK_UNIT_LABELS,
  formatProductivity,
} from '../lib/types';
import {
  computeWorkTypeKpis,
  computeWorkTypeTrends,
  RECENT_PERIOD_DAYS,
  type OutlierHandlingMode,
  WorkTypeKpi,
  WorkTypeTrend,
  ConfidenceLevel,
  TrendDirection,
  workTypeKeyString,
} from '../lib/kpi';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { pluralize } from '../lib/utils/pluralize';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import { CalculatorIcon } from './icons';
import { LoadingBlock } from './LoadingBlock';

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
  insufficient: 'Insufficient data',
};

const TREND_ARROWS: Record<TrendDirection, string> = {
  improving: '\u2191',
  stable: '\u2192',
  declining: '\u2193',
};

interface KpiSectionProps {
  tasks: Task[];
  outlierMode: OutlierHandlingMode;
}

export function KpiSection({ tasks, outlierMode }: KpiSectionProps) {
  const { workTypes } = useWorkTypeStore();
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const [trends, setTrends] = useState<Map<string, WorkTypeTrend>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Only fetch entries for completed tasks with work data
      const qualifying = tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.workUnit != null &&
          t.workQuantity != null &&
          t.workQuantity > 0 &&
          t.workTypeId != null
      );

      const { entriesByTask } = await buildAttributedRollup(qualifying, tasks);

      if (cancelled) return;

      const results = computeWorkTypeKpis(tasks, entriesByTask, {
        workTypes,
        archiveOnly: true,
        outlierMode,
      });
      const trendResults = computeWorkTypeTrends(
        tasks,
        entriesByTask,
        RECENT_PERIOD_DAYS,
        undefined,
        { workTypes, archiveOnly: true, outlierMode },
      );
      const trendMap = new Map(trendResults.map((t) => [workTypeKeyString(t.key), t]));

      setKpis(results);
      setTrends(trendMap);
      setIsLoading(false);
    }

    setIsLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [tasks, workTypes, outlierMode]);

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (kpis.length === 0) {
    return (
      <div className="empty-state">
        <CalculatorIcon className="empty-state__icon" aria-hidden />
        <p className="empty-state__heading">No productivity data yet</p>
        <p className="empty-state__text">Complete tasks with work quantity to see KPIs.</p>
      </div>
    );
  }

  return (
    <div className="productivity__kpi-list">
      {kpis.map((kpi) => {
        const { key } = kpi;
        const label = [
          key.workTypeTitle,
          WORK_UNIT_LABELS[key.workUnit],
        ]
          .filter(Boolean)
          .join(' · ');

        const isInsufficient = kpi.confidence === 'insufficient';
        const trend = trends.get(workTypeKeyString(key));

        return (
          <div key={workTypeKeyString(key)} className="productivity__kpi">
            <div className="productivity__kpi-header">
              <span className="productivity__kpi-label">{label}</span>
              <span className={`kpi-badge kpi-badge--${kpi.confidence}`}>
                {CONFIDENCE_LABELS[kpi.confidence]}
              </span>
            </div>

            {isInsufficient ? (
              <span className="productivity__kpi-insufficient">
                {pluralize(kpi.sampleCount, 'task')} — need 3 or more for estimates
              </span>
            ) : (
              <>
                <span className="productivity__kpi-rate">
                  {formatProductivity(kpi.avgProductivity, key.workUnit)}
                </span>
                <div className="productivity__kpi-meta">
                  <span className="productivity__kpi-stat">
                    {pluralize(kpi.sampleCount, 'task')} · {Math.round(kpi.totalQuantity)} {WORK_UNIT_LABELS[key.workUnit]} completed
                  </span>
                  {(kpi.cv != null && kpi.cv > 0 || trend?.direction != null) && (
                    <span className="productivity__kpi-stat">
                      {kpi.cv != null && kpi.cv > 0 && `±${Math.round(kpi.cv * 100)}% variation`}
                      {kpi.cv != null && kpi.cv > 0 && trend?.direction != null && ' · '}
                      {trend?.direction != null && (
                        <span className={`kpi-trend kpi-trend--${trend.direction}`}>
                          {TREND_ARROWS[trend.direction]}
                          {trend.changePercent != null && ` ${Math.abs(Math.round(trend.changePercent * 100))}%`}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

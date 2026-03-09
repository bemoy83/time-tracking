import { useEffect, useMemo, useState } from 'react';
import { buildAttributedRollup } from '../../lib/attributed-rollup';
import {
  MIN_SAMPLE_COUNT,
  computeWorkTypeKpis,
  computeWorkTypeTrends,
  workTypeKeyString,
  type WorkTypeKpi,
  type WorkTypeTrend,
} from '../../lib/kpi';
import { LoadingBlock } from '../../components/LoadingBlock';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, WorkType } from '../../lib/types';
import { WORK_UNIT_LABELS } from '../../lib/types';

export type InsightsWindow = 'this-month' | 'last-3-months' | 'last-6-months' | 'all-time';

export type InsightsScope = 'all' | 'plan';

export interface InsightsRow {
  kpi: WorkTypeKpi;
  trend: WorkTypeTrend | null;
}

const HIGH_VARIANCE_THRESHOLD = 0.3;

export function windowStart(window: InsightsWindow, now: Date): Date | null {
  if (window === 'all-time') return null;
  if (window === 'this-month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  const months = window === 'last-3-months' ? 3 : 6;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate(), 0, 0, 0, 0));
}

export function filterTasksForInsightsWindow(
  tasks: Task[],
  window: InsightsWindow,
  now: Date = new Date(),
): Task[] {
  const start = windowStart(window, now);
  if (start == null) return tasks;
  return tasks.filter((task) => new Date(task.updatedAt).getTime() >= start.getTime());
}

function formatTrend(row: InsightsRow): string {
  if (!row.trend?.direction || row.trend.changePercent == null) return '—';
  const change = row.trend.changePercent * 100;
  return `${row.trend.direction} (${change > 0 ? '+' : ''}${change.toFixed(0)}%)`;
}

function formatRate(kpi: WorkTypeKpi): string {
  const unit = WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit;
  return `${kpi.avgProductivity.toFixed(1)} ${unit}/person-hr`;
}

function needsCautionLabel(kpi: WorkTypeKpi): boolean {
  return kpi.confidence === 'insufficient' || kpi.confidence === 'low';
}

function byTitle(a: InsightsRow, b: InsightsRow): number {
  const titleCmp = a.kpi.key.workTypeTitle.localeCompare(b.kpi.key.workTypeTitle);
  if (titleCmp !== 0) return titleCmp;
  const unitCmp = a.kpi.key.workUnit.localeCompare(b.kpi.key.workUnit);
  return unitCmp;
}

export function buildInsightsRows(
  kpis: WorkTypeKpi[],
  trends: WorkTypeTrend[],
): { stable: InsightsRow[]; highVariance: InsightsRow[] } {
  const trendByKey = new Map(trends.map((trend) => [workTypeKeyString(trend.key), trend]));
  const rows = kpis.map((kpi) => ({
    kpi,
    trend: trendByKey.get(workTypeKeyString(kpi.key)) ?? null,
  }));
  const stable = rows
    .filter((row) => row.kpi.cv == null || row.kpi.cv <= HIGH_VARIANCE_THRESHOLD)
    .sort(byTitle);
  const highVariance = rows
    .filter((row) => row.kpi.cv != null && row.kpi.cv > HIGH_VARIANCE_THRESHOLD)
    .sort(byTitle);
  return { stable, highVariance };
}

interface InsightsViewProps {
  tasks: Task[];
  workTypes: WorkType[];
  /** When set, show per-plan metrics for this plan only. Excludes all other plans. */
  planId?: string | null;
  /** Display title for the plan (when planId is set). */
  planTitle?: string;
  /** Plans list for scope selector in global view. When provided, user can switch between "All plans" and a specific plan. */
  plans?: Plan[];
}

export function InsightsView({ tasks, workTypes, planId: propPlanId, planTitle: propPlanTitle, plans = [] }: InsightsViewProps) {
  // Per-plan view: default to all-time since plan execution may have occurred in the past
  const [window, setWindow] = useState<InsightsWindow>(() => (propPlanId ? 'all-time' : 'this-month'));
  const [scope, setScope] = useState<InsightsScope>('all');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [rows, setRows] = useState<{ stable: InsightsRow[]; highVariance: InsightsRow[] }>({
    stable: [],
    highVariance: [],
  });
  const [loading, setLoading] = useState(false);

  const effectivePlanId = propPlanId ?? (scope === 'plan' && selectedPlanId ? selectedPlanId : null);
  const effectivePlanTitle = propPlanTitle ?? (effectivePlanId ? plans.find((p) => p.id === effectivePlanId)?.title ?? null : null);
  const plansWithTasks = useMemo(
    () => plans.filter((p) => tasks.some((t) => t.sourcePlanId === p.id)),
    [plans, tasks],
  );

  const filteredCompletedTasks = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'completed');
    return filterTasksForInsightsWindow(completed, window);
  }, [tasks, window]);

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      if (filteredCompletedTasks.length === 0) {
        setRows({ stable: [], highVariance: [] });
        return;
      }

      setLoading(true);
      try {
        const rollup = await buildAttributedRollup(filteredCompletedTasks, tasks);
        const kpiOptions = {
          archiveOnly: false,
          workTypes,
          planId: effectivePlanId ?? undefined,
        };
        const kpis = computeWorkTypeKpis(filteredCompletedTasks, rollup.entriesByTask, kpiOptions);
        const trends = computeWorkTypeTrends(
          filteredCompletedTasks,
          rollup.entriesByTask,
          undefined,
          undefined,
          kpiOptions,
        );
        if (!cancelled) {
          setRows(buildInsightsRows(kpis, trends));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void compute();
    return () => {
      cancelled = true;
    };
  }, [filteredCompletedTasks, tasks, workTypes, effectivePlanId]);

  const allRows = [...rows.stable, ...rows.highVariance];
  const showScopeSelector = plans.length > 0 && propPlanId == null;
  return (
    <div className="planning-view insights-view">
      <header className="planning-view__header">
        <h1 className="planning-view__title">
          {effectivePlanTitle ? `Insights: ${effectivePlanTitle}` : 'Insights'}
        </h1>
      </header>

      {showScopeSelector && (
        <div className="insights-view__scope" role="group" aria-label="Scope">
          <span className="insights-view__scope-label">Scope:</span>
          <button
            type="button"
            className={`insights-view__scope-btn${scope === 'all' ? ' insights-view__scope-btn--active' : ''}`}
            onClick={() => setScope('all')}
          >
            All plans
          </button>
          <button
            type="button"
            className={`insights-view__scope-btn${scope === 'plan' ? ' insights-view__scope-btn--active' : ''}`}
            onClick={() => setScope('plan')}
          >
            Per plan
          </button>
          {scope === 'plan' && (
            <select
              className="insights-view__scope-select"
              value={selectedPlanId ?? ''}
              onChange={(e) => setSelectedPlanId(e.target.value || null)}
              aria-label="Select plan"
            >
              <option value="">Select a plan…</option>
              {plansWithTasks.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="insights-view__filters" role="group" aria-label="Insights time window">
        <button
          type="button"
          className={`insights-view__filter-btn${window === 'this-month' ? ' insights-view__filter-btn--active' : ''}`}
          onClick={() => setWindow('this-month')}
        >
          This month
        </button>
        <button
          type="button"
          className={`insights-view__filter-btn${window === 'last-3-months' ? ' insights-view__filter-btn--active' : ''}`}
          onClick={() => setWindow('last-3-months')}
        >
          Last 3 months
        </button>
        <button
          type="button"
          className={`insights-view__filter-btn${window === 'last-6-months' ? ' insights-view__filter-btn--active' : ''}`}
          onClick={() => setWindow('last-6-months')}
        >
          Last 6 months
        </button>
        <button
          type="button"
          className={`insights-view__filter-btn${window === 'all-time' ? ' insights-view__filter-btn--active' : ''}`}
          onClick={() => setWindow('all-time')}
        >
          All time
        </button>
      </div>

      {loading ? (
        <LoadingBlock message="Loading insights…" />
      ) : allRows.length === 0 ? (
        <p className="insights-view__empty">
          {effectivePlanId
            ? 'No KPI data for this plan. Try selecting "All time" if the plan was completed earlier. Per-plan KPIs require completed tasks with work quantity, time entries, and matching work types.'
            : 'No KPI data available for the selected time window.'}
        </p>
      ) : (
        <>
          <section className="insights-view__table" aria-label="Work type performance">
            {rows.stable.length > 0 && (
              <p className="insights-view__guidance">
                Use these rates for planning when sample size and variance are sufficient.
              </p>
            )}
            {rows.stable.map((row) => {
              const insufficient = row.kpi.sampleCount < MIN_SAMPLE_COUNT;
              const caution = needsCautionLabel(row.kpi);

              return (
                <article
                  key={workTypeKeyString(row.kpi.key)}
                  className={`insights-view__row${insufficient ? ' insights-view__row--insufficient' : ''}`}
                >
                  <div>
                    <h3 className="insights-view__title-row">
                      {row.kpi.key.workTypeTitle}
                      {caution && (
                        <span className="insights-view__caution-badge">Use with caution</span>
                      )}
                    </h3>
                    <p className="insights-view__meta">
                      {WORK_UNIT_LABELS[row.kpi.key.workUnit]}
                    </p>
                  </div>
                  <div className="insights-view__stats">
                    <span>{formatRate(row.kpi)}</span>
                    <span>{row.kpi.sampleCount} samples</span>
                    <span>Confidence: {row.kpi.confidence}</span>
                    <span>CV: {row.kpi.cv == null ? '—' : row.kpi.cv.toFixed(2)}</span>
                    <span>Trend: {formatTrend(row)}</span>
                    <span>Outliers: {row.kpi.outlierCount}</span>
                  </div>
                  {row.kpi.confidence === 'insufficient' && (
                    <p className="insights-view__hint">
                      Add more completed tasks to improve reliability.
                    </p>
                  )}
                </article>
              );
            })}
          </section>

          {rows.highVariance.length > 0 && (
            <section className="insights-view__variance" aria-label="Less reliable for estimating">
              <h2 className="insights-view__variance-title">Less Reliable for Estimating</h2>
              <p className="insights-view__guidance insights-view__guidance--caution">
                Use with caution — limited samples or high variance. Prefer template or manual rates until more data is available.
              </p>
              <div className="insights-view__table">
                {rows.highVariance.map((row) => {
                  const caution = needsCautionLabel(row.kpi);
                  return (
                    <article key={workTypeKeyString(row.kpi.key)} className="insights-view__row insights-view__row--variance">
                      <div>
                        <h3 className="insights-view__title-row">
                          {row.kpi.key.workTypeTitle}
                          {caution && (
                            <span className="insights-view__caution-badge">Use with caution</span>
                          )}
                        </h3>
                        <p className="insights-view__meta">
                          {WORK_UNIT_LABELS[row.kpi.key.workUnit]}
                        </p>
                      </div>
                      <div className="insights-view__stats">
                        <span>{formatRate(row.kpi)}</span>
                        <span>{row.kpi.sampleCount} samples</span>
                        <span>Confidence: {row.kpi.confidence}</span>
                        <span>CV: {row.kpi.cv == null ? '—' : row.kpi.cv.toFixed(2)}</span>
                        <span>Trend: {formatTrend(row)}</span>
                        <span>Outliers: {row.kpi.outlierCount}</span>
                      </div>
                      {row.kpi.confidence === 'insufficient' && (
                        <p className="insights-view__hint">
                          Add more completed tasks to improve reliability.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

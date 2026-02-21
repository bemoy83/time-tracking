/**
 * KPI computation for completed tasks.
 * Groups by Work Type (workCategory + workUnit + buildPhase)
 * and calculates average achieved productivity.
 *
 * Phase 2: Adds confidence classification and stability indicator.
 */

import type { Task, WorkCategory, WorkUnit, BuildPhase, AttributedEntry } from './types';

// --- Sample thresholds ---
export const MIN_SAMPLE_COUNT = 3;    // Below this: insufficient data
export const MED_SAMPLE_COUNT = 5;    // Below this: low confidence
export const HIGH_SAMPLE_COUNT = 10;  // At or above: high confidence

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export interface WorkTypeKey {
  workCategory: WorkCategory;
  workUnit: WorkUnit;
  buildPhase: BuildPhase | null;
}

export interface WorkTypeKpi {
  key: WorkTypeKey;
  sampleCount: number;
  avgProductivity: number; // units/person-hr
  totalQuantity: number;
  totalPersonHours: number;
  confidence: ConfidenceLevel;
  /** Coefficient of variation (stddev / mean). Lower = more stable. null if < 2 samples. */
  cv: number | null;
  /** Number of per-task rates flagged as outliers (IQR method). 0 if < 4 samples. */
  outlierCount: number;
}

/** Classify confidence based on sample count. */
export function classifyConfidence(sampleCount: number): ConfidenceLevel {
  if (sampleCount < MIN_SAMPLE_COUNT) return 'insufficient';
  if (sampleCount < MED_SAMPLE_COUNT) return 'low';
  if (sampleCount < HIGH_SAMPLE_COUNT) return 'medium';
  return 'high';
}

/**
 * Detect outliers using IQR method (deterministic, documented).
 * Returns indices of values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR].
 * Requires ≥4 samples for meaningful quartile computation.
 */
export function detectOutliers(rates: number[]): number[] {
  if (rates.length < 4) return [];

  const sorted = [...rates].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const outlierIndices: number[] = [];
  for (let i = 0; i < rates.length; i++) {
    if (rates[i] < lower || rates[i] > upper) {
      outlierIndices.push(i);
    }
  }
  return outlierIndices;
}

/** Compute coefficient of variation from per-task productivity rates. */
export function computeCV(rates: number[]): number | null {
  if (rates.length < 2) return null;
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  if (mean === 0) return null;
  const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  return Math.sqrt(variance) / mean;
}

export function workTypeKeyString(key: WorkTypeKey): string {
  return `${key.workCategory}:${key.workUnit}:${key.buildPhase ?? '_'}`;
}

export function findKpiByKey(kpis: WorkTypeKpi[], key: WorkTypeKey): WorkTypeKpi | undefined {
  const target = workTypeKeyString(key);
  return kpis.find((k) => workTypeKeyString(k.key) === target);
}

export interface KpiOptions {
  /** When true, only include archive-grade tasks (archivedAt != null). Default: false. */
  archiveOnly?: boolean;
}

/**
 * Compute KPIs grouped by Work Type from completed tasks and their attributed entries.
 * @param tasks All tasks (will be filtered to completed with work data)
 * @param entriesByTask Map of taskId → AttributedEntry[] for qualifying tasks
 * @param options Optional configuration (e.g., archiveOnly filtering)
 */
export function computeWorkTypeKpis(
  tasks: Task[],
  entriesByTask: Map<string, AttributedEntry[]>,
  options: KpiOptions = {},
): WorkTypeKpi[] {
  const { archiveOnly = false } = options;

  // Filter to completed tasks with required work data
  const qualifying = tasks.filter(
    (t) =>
      t.status === 'completed' &&
      t.workCategory != null &&
      t.workUnit != null &&
      t.workQuantity != null &&
      t.workQuantity > 0 &&
      (!archiveOnly || t.archivedAt != null)
  );

  // Accumulate per Work Type, tracking per-task rates for stability
  const groups = new Map<
    string,
    { key: WorkTypeKey; totalQuantity: number; totalPersonHours: number; sampleCount: number; rates: number[] }
  >();

  for (const task of qualifying) {
    const entries = entriesByTask.get(task.id) ?? [];

    // Sum person-hours from attributed entries (precomputed)
    let personHours = 0;
    for (const entry of entries) {
      personHours += entry.personHours;
    }

    // Skip tasks with no tracked time
    if (personHours <= 0) continue;

    const key: WorkTypeKey = {
      workCategory: task.workCategory!,
      workUnit: task.workUnit!,
      buildPhase: task.buildPhase,
    };
    const keyStr = workTypeKeyString(key);
    const taskRate = task.workQuantity! / personHours;

    const existing = groups.get(keyStr);
    if (existing) {
      existing.totalQuantity += task.workQuantity!;
      existing.totalPersonHours += personHours;
      existing.sampleCount += 1;
      existing.rates.push(taskRate);
    } else {
      groups.set(keyStr, {
        key,
        totalQuantity: task.workQuantity!,
        totalPersonHours: personHours,
        sampleCount: 1,
        rates: [taskRate],
      });
    }
  }

  // Build result array
  const results: WorkTypeKpi[] = [];
  for (const group of groups.values()) {
    results.push({
      key: group.key,
      sampleCount: group.sampleCount,
      avgProductivity: group.totalQuantity / group.totalPersonHours,
      totalQuantity: group.totalQuantity,
      totalPersonHours: group.totalPersonHours,
      confidence: classifyConfidence(group.sampleCount),
      cv: computeCV(group.rates),
      outlierCount: detectOutliers(group.rates).length,
    });
  }

  // Sort by category, then unit, then phase
  results.sort((a, b) => {
    const cmp = a.key.workCategory.localeCompare(b.key.workCategory);
    if (cmp !== 0) return cmp;
    const cmp2 = a.key.workUnit.localeCompare(b.key.workUnit);
    if (cmp2 !== 0) return cmp2;
    return (a.key.buildPhase ?? '').localeCompare(b.key.buildPhase ?? '');
  });

  return results;
}

// --- Trend analysis ---

export const RECENT_PERIOD_DAYS = 30;

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface WorkTypeTrend {
  key: WorkTypeKey;
  recent: WorkTypeKpi | null;
  baseline: WorkTypeKpi | null;
  direction: TrendDirection | null; // null if either period has insufficient data
  changePercent: number | null;     // positive = improving (higher productivity)
}

/** Threshold for considering a change significant (±5%). */
const TREND_THRESHOLD = 0.05;

/**
 * Split tasks into recent (completed within `recentDays` of `now`) and baseline (older).
 * Uses `updatedAt` as proxy for completion time.
 */
export function splitByPeriod(
  tasks: Task[],
  recentDays: number = RECENT_PERIOD_DAYS,
  now: Date = new Date(),
): { recent: Task[]; baseline: Task[] } {
  const cutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000).toISOString();
  const recent: Task[] = [];
  const baseline: Task[] = [];

  for (const t of tasks) {
    if (t.updatedAt >= cutoff) {
      recent.push(t);
    } else {
      baseline.push(t);
    }
  }

  return { recent, baseline };
}

/**
 * Compute trend direction from two KPI periods.
 * Improving = recent productivity higher than baseline.
 */
export function computeTrendDirection(
  recent: WorkTypeKpi | null,
  baseline: WorkTypeKpi | null,
): { direction: TrendDirection | null; changePercent: number | null } {
  if (!recent || !baseline) return { direction: null, changePercent: null };
  if (recent.confidence === 'insufficient' || baseline.confidence === 'insufficient') {
    return { direction: null, changePercent: null };
  }

  if (baseline.avgProductivity === 0) return { direction: null, changePercent: null };

  const change = (recent.avgProductivity - baseline.avgProductivity) / baseline.avgProductivity;

  let direction: TrendDirection;
  if (change > TREND_THRESHOLD) {
    direction = 'improving';
  } else if (change < -TREND_THRESHOLD) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }

  return { direction, changePercent: change };
}

/**
 * Compute trends for all Work Types by comparing recent vs baseline periods.
 */
export function computeWorkTypeTrends(
  tasks: Task[],
  entriesByTask: Map<string, AttributedEntry[]>,
  recentDays: number = RECENT_PERIOD_DAYS,
  now?: Date,
  options: KpiOptions = {},
): WorkTypeTrend[] {
  const { recent, baseline } = splitByPeriod(tasks, recentDays, now);

  const recentKpis = computeWorkTypeKpis(recent, entriesByTask, options);
  const baselineKpis = computeWorkTypeKpis(baseline, entriesByTask, options);

  // Collect all unique keys
  const allKeys = new Map<string, WorkTypeKey>();
  for (const kpi of [...recentKpis, ...baselineKpis]) {
    allKeys.set(workTypeKeyString(kpi.key), kpi.key);
  }

  const trends: WorkTypeTrend[] = [];
  for (const key of allKeys.values()) {
    const recentKpi = findKpiByKey(recentKpis, key) ?? null;
    const baselineKpi = findKpiByKey(baselineKpis, key) ?? null;
    const { direction, changePercent } = computeTrendDirection(recentKpi, baselineKpi);

    trends.push({ key, recent: recentKpi, baseline: baselineKpi, direction, changePercent });
  }

  return trends;
}

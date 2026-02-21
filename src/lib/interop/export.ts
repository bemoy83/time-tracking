/**
 * KPI export contract — serializes WorkTypeKpi data to CSV format.
 *
 * Export profiles:
 * 1. ops_summary — all KPIs with key metrics
 * 2. estimator_summary — includes confidence, CV, outliers
 * 3. phase_summary — grouped by buildPhase
 *
 * Stable mapping key: workCategory:workUnit:buildPhase
 * Used for round-trip import/export reliability.
 */

import type { WorkTypeKpi } from '../kpi';
import { workTypeKeyString } from '../kpi';
import { WORK_UNIT_LABELS, WORK_CATEGORY_LABELS } from '../types';

export type ExportProfile = 'ops_summary' | 'estimator_summary' | 'phase_summary';

/** Escape a CSV field value (handles commas, quotes, newlines). */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | number | null)[]): string {
  return fields
    .map((f) => {
      if (f == null) return '';
      if (typeof f === 'number') return f.toString();
      return csvEscape(f);
    })
    .join(',');
}

/**
 * Export KPIs using the ops_summary profile.
 * Columns: mappingKey, workCategory, workUnit, buildPhase, sampleCount,
 *          avgProductivity, totalQuantity, totalPersonHours
 */
export function exportOpsSummary(kpis: WorkTypeKpi[]): string {
  const headers = [
    'mappingKey', 'workCategory', 'workUnit', 'buildPhase',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
  ];
  const rows = kpis.map((kpi) =>
    csvRow([
      workTypeKeyString(kpi.key),
      WORK_CATEGORY_LABELS[kpi.key.workCategory] ?? kpi.key.workCategory,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.key.buildPhase ?? '',
      kpi.sampleCount,
      round(kpi.avgProductivity, 2),
      round(kpi.totalQuantity, 1),
      round(kpi.totalPersonHours, 2),
    ]),
  );
  return [csvRow(headers), ...rows].join('\n');
}

/**
 * Export KPIs using the estimator_summary profile.
 * Adds confidence, CV, and outlier columns for planning use.
 */
export function exportEstimatorSummary(kpis: WorkTypeKpi[]): string {
  const headers = [
    'mappingKey', 'workCategory', 'workUnit', 'buildPhase',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
    'confidence', 'cv', 'outlierCount',
  ];
  const rows = kpis.map((kpi) =>
    csvRow([
      workTypeKeyString(kpi.key),
      WORK_CATEGORY_LABELS[kpi.key.workCategory] ?? kpi.key.workCategory,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.key.buildPhase ?? '',
      kpi.sampleCount,
      round(kpi.avgProductivity, 2),
      round(kpi.totalQuantity, 1),
      round(kpi.totalPersonHours, 2),
      kpi.confidence,
      kpi.cv != null ? round(kpi.cv, 3) : null,
      kpi.outlierCount,
    ]),
  );
  return [csvRow(headers), ...rows].join('\n');
}

/**
 * Export KPIs using the phase_summary profile.
 * Groups by buildPhase, then lists work types within each phase.
 */
export function exportPhaseSummary(kpis: WorkTypeKpi[]): string {
  const headers = [
    'buildPhase', 'mappingKey', 'workCategory', 'workUnit',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
  ];

  // Sort by phase first
  const sorted = [...kpis].sort((a, b) => {
    const pa = a.key.buildPhase ?? '';
    const pb = b.key.buildPhase ?? '';
    if (pa !== pb) return pa.localeCompare(pb);
    return a.key.workCategory.localeCompare(b.key.workCategory);
  });

  const rows = sorted.map((kpi) =>
    csvRow([
      kpi.key.buildPhase ?? '',
      workTypeKeyString(kpi.key),
      WORK_CATEGORY_LABELS[kpi.key.workCategory] ?? kpi.key.workCategory,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.sampleCount,
      round(kpi.avgProductivity, 2),
      round(kpi.totalQuantity, 1),
      round(kpi.totalPersonHours, 2),
    ]),
  );
  return [csvRow(headers), ...rows].join('\n');
}

/**
 * Export KPIs using the specified profile.
 */
export function exportKpis(kpis: WorkTypeKpi[], profile: ExportProfile): string {
  switch (profile) {
    case 'ops_summary':
      return exportOpsSummary(kpis);
    case 'estimator_summary':
      return exportEstimatorSummary(kpis);
    case 'phase_summary':
      return exportPhaseSummary(kpis);
  }
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

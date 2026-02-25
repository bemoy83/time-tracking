/**
 * KPI export contract — serializes WorkTypeKpi data to CSV format.
 *
 * Export profiles:
 * 1. ops_summary — all KPIs with key metrics
 * 2. estimator_summary — includes confidence, CV, outliers
 * 3. phase_summary — grouped by buildPhase
 *
 * Stable mapping key: workTypeTitle:workUnit:buildPhase
 * Used for round-trip import/export reliability.
 */

import type { WorkTypeKpi } from '../kpi';
import { workTypeKeyString } from '../kpi';
import { WORK_UNIT_LABELS } from '../types';
import { csvRow } from './csv-utils';

export type ExportProfile = 'ops_summary' | 'estimator_summary' | 'phase_summary';

/**
 * Export KPIs using the ops_summary profile.
 * Columns: mappingKey, workTypeTitle, workUnit, buildPhase, sampleCount,
 *          avgProductivity, totalQuantity, totalPersonHours
 */
export function exportOpsSummary(kpis: WorkTypeKpi[]): string {
  const headers = [
    'mappingKey', 'workTypeTitle', 'workUnit', 'buildPhase', 'workTypeId',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
  ];
  const rows = kpis.map((kpi) =>
    csvRow([
      workTypeKeyString(kpi.key),
      kpi.key.workTypeTitle,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.key.buildPhase ?? '',
      kpi.key.workTypeId ?? '',
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
    'mappingKey', 'workTypeTitle', 'workUnit', 'buildPhase', 'workTypeId',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
    'confidence', 'cv', 'outlierCount',
  ];
  const rows = kpis.map((kpi) =>
    csvRow([
      workTypeKeyString(kpi.key),
      kpi.key.workTypeTitle,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.key.buildPhase ?? '',
      kpi.key.workTypeId ?? '',
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
    'buildPhase', 'mappingKey', 'workTypeTitle', 'workUnit', 'workTypeId',
    'sampleCount', 'avgProductivity', 'totalQuantity', 'totalPersonHours',
  ];

  // Sort by phase first
  const sorted = [...kpis].sort((a, b) => {
    const pa = a.key.buildPhase ?? '';
    const pb = b.key.buildPhase ?? '';
    if (pa !== pb) return pa.localeCompare(pb);
    return a.key.workTypeTitle.localeCompare(b.key.workTypeTitle);
  });

  const rows = sorted.map((kpi) =>
    csvRow([
      kpi.key.buildPhase ?? '',
      workTypeKeyString(kpi.key),
      kpi.key.workTypeTitle,
      WORK_UNIT_LABELS[kpi.key.workUnit] ?? kpi.key.workUnit,
      kpi.key.workTypeId ?? '',
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

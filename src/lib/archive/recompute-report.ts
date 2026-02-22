/**
 * "What changed" report for archived KPI recomputation runs.
 */

import type { WorkTypeKpi } from '../kpi';
import { workTypeKeyString } from '../kpi';
import type { RecomputedArchiveKpiGroup } from './recompute';

export type KpiChangeStatus = 'added' | 'removed' | 'changed';

export interface KpiChangeItem {
  archiveVersion: string;
  key: string;
  status: KpiChangeStatus;
  before: WorkTypeKpi | null;
  after: WorkTypeKpi | null;
  avgProductivityDelta: number | null;
  sampleCountDelta: number | null;
}

export interface RecomputeChangeReport {
  totalAdded: number;
  totalRemoved: number;
  totalChanged: number;
  totalChanges: number;
  changes: KpiChangeItem[];
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isSameKpi(a: WorkTypeKpi, b: WorkTypeKpi): boolean {
  return (
    roundTo(a.avgProductivity, 6) === roundTo(b.avgProductivity, 6) &&
    a.sampleCount === b.sampleCount &&
    roundTo(a.totalQuantity, 6) === roundTo(b.totalQuantity, 6) &&
    roundTo(a.totalPersonHours, 6) === roundTo(b.totalPersonHours, 6) &&
    a.confidence === b.confidence &&
    roundTo(a.cv ?? 0, 6) === roundTo(b.cv ?? 0, 6) &&
    a.outlierCount === b.outlierCount
  );
}

function flatten(groups: RecomputedArchiveKpiGroup[]): Map<string, WorkTypeKpi> {
  const map = new Map<string, WorkTypeKpi>();
  for (const group of groups) {
    for (const kpi of group.kpis) {
      const key = `${group.archiveVersion}::${workTypeKeyString(kpi.key)}`;
      map.set(key, kpi);
    }
  }
  return map;
}

export function createRecomputeChangeReport(
  beforeGroups: RecomputedArchiveKpiGroup[],
  afterGroups: RecomputedArchiveKpiGroup[],
): RecomputeChangeReport {
  const before = flatten(beforeGroups);
  const after = flatten(afterGroups);
  const allKeys = new Set<string>([...before.keys(), ...after.keys()]);

  const changes: KpiChangeItem[] = [];
  for (const compoundKey of allKeys) {
    const beforeKpi = before.get(compoundKey) ?? null;
    const afterKpi = after.get(compoundKey) ?? null;
    const [archiveVersion, ...keyParts] = compoundKey.split('::');
    const key = keyParts.join('::');

    if (beforeKpi == null && afterKpi != null) {
      changes.push({
        archiveVersion,
        key,
        status: 'added',
        before: null,
        after: afterKpi,
        avgProductivityDelta: null,
        sampleCountDelta: null,
      });
      continue;
    }

    if (beforeKpi != null && afterKpi == null) {
      changes.push({
        archiveVersion,
        key,
        status: 'removed',
        before: beforeKpi,
        after: null,
        avgProductivityDelta: null,
        sampleCountDelta: null,
      });
      continue;
    }

    if (beforeKpi != null && afterKpi != null && !isSameKpi(beforeKpi, afterKpi)) {
      changes.push({
        archiveVersion,
        key,
        status: 'changed',
        before: beforeKpi,
        after: afterKpi,
        avgProductivityDelta: afterKpi.avgProductivity - beforeKpi.avgProductivity,
        sampleCountDelta: afterKpi.sampleCount - beforeKpi.sampleCount,
      });
    }
  }

  const totalAdded = changes.filter((c) => c.status === 'added').length;
  const totalRemoved = changes.filter((c) => c.status === 'removed').length;
  const totalChanged = changes.filter((c) => c.status === 'changed').length;

  return {
    totalAdded,
    totalRemoved,
    totalChanged,
    totalChanges: changes.length,
    changes: changes.sort((a, b) => {
      const versionCmp = a.archiveVersion.localeCompare(b.archiveVersion);
      if (versionCmp !== 0) return versionCmp;
      return a.key.localeCompare(b.key);
    }),
  };
}

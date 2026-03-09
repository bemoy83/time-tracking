import { describe, expect, it } from 'vitest';
import type { WorkTypeKpi } from '../kpi';
import { createRecomputeChangeReport } from './recompute-report';
import type { RecomputedArchiveKpiGroup } from './recompute';

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: {
      workTypeId: 'wt-1',
      workTypeTitle: 'Carpet Tiles',
      workUnit: 'm2',
    },
    sampleCount: 5,
    avgProductivity: 10,
    totalQuantity: 100,
    totalPersonHours: 10,
    confidence: 'medium',
    cv: 0.1,
    outlierCount: 0,
    ...overrides,
  };
}

function makeGroup(version: string, kpis: WorkTypeKpi[]): RecomputedArchiveKpiGroup {
  return {
    archiveVersion: version,
    taskCount: kpis.length,
    kpis,
  };
}

describe('createRecomputeChangeReport', () => {
  it('reports added, removed, and changed KPI keys', () => {
    const before = [
      makeGroup('v1', [makeKpi()]),
      makeGroup('v2', [makeKpi({
        key: { workTypeId: 'wt-2', workTypeTitle: 'Furniture', workUnit: 'pcs' },
      })]),
    ];
    const after = [
      makeGroup('v1', [makeKpi({ avgProductivity: 12 })]), // changed
      makeGroup('v3', [makeKpi({
        key: { workTypeId: 'wt-3', workTypeTitle: 'Walls', workUnit: 'm2' },
      })]), // added
    ];

    const report = createRecomputeChangeReport(before, after);

    expect(report.totalChanged).toBe(1);
    expect(report.totalAdded).toBe(1);
    expect(report.totalRemoved).toBe(1);
    expect(report.totalChanges).toBe(3);
    expect(report.changes.find((c) => c.status === 'changed')?.avgProductivityDelta).toBe(2);
  });

  it('returns zero changes for equivalent groups', () => {
    const groups = [makeGroup('v1', [makeKpi()])];
    const report = createRecomputeChangeReport(groups, groups);

    expect(report.totalChanges).toBe(0);
    expect(report.changes).toHaveLength(0);
  });
});

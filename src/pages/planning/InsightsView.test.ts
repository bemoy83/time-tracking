import { describe, expect, it } from 'vitest';
import type { Task } from '../../lib/types';
import type { WorkTypeKpi, WorkTypeTrend } from '../../lib/kpi';
import { buildInsightsRows, filterTasksForInsightsWindow } from './InsightsView';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    sourcePlanId: null,
    sourceLineItemId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    crew: 1,
    targetProductivity: null,
    buildPhase: 'assembly',
    workTypeId: 'wt-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: '2024-01-01T00:00:00.000Z',
    archiveVersion: 'v1',
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: {
      workTypeId: 'wt-1',
      workTypeTitle: 'Carpet Tiles',
      workUnit: 'm2',
    },
    sampleCount: 6,
    avgProductivity: 12,
    totalQuantity: 120,
    totalPersonHours: 10,
    confidence: 'medium',
    cv: 0.2,
    outlierCount: 0,
    ...overrides,
  };
}

function makeTrend(overrides: Partial<WorkTypeTrend> = {}): WorkTypeTrend {
  const key = makeKpi().key;
  return {
    key,
    recent: makeKpi(),
    baseline: makeKpi({ avgProductivity: 10 }),
    direction: 'improving',
    changePercent: 0.2,
    ...overrides,
  };
}

describe('buildInsightsRows', () => {
  it('splits stable and high-variance work types', () => {
    const stableKpi = makeKpi({ key: { ...makeKpi().key, workTypeTitle: 'Stable Type' }, cv: 0.15 });
    const highVarianceKpi = makeKpi({
      key: { ...makeKpi().key, workTypeTitle: 'Variance Type', workTypeId: 'wt-2' },
      cv: 0.5,
    });
    const trends = [
      makeTrend({ key: stableKpi.key }),
      makeTrend({ key: highVarianceKpi.key, direction: 'declining', changePercent: -0.1 }),
    ];

    const rows = buildInsightsRows([stableKpi, highVarianceKpi], trends);

    expect(rows.stable).toHaveLength(1);
    expect(rows.stable[0].kpi.key.workTypeTitle).toBe('Stable Type');
    expect(rows.highVariance).toHaveLength(1);
    expect(rows.highVariance[0].kpi.key.workTypeTitle).toBe('Variance Type');
  });
});

describe('filterTasksForInsightsWindow', () => {
  const now = new Date('2026-02-26T12:00:00.000Z');

  it('filters tasks for this-month window', () => {
    const recentTask = makeTask({ id: 'recent', updatedAt: '2026-02-10T00:00:00.000Z' });
    const oldTask = makeTask({ id: 'old', updatedAt: '2026-01-20T00:00:00.000Z' });
    const filtered = filterTasksForInsightsWindow([recentTask, oldTask], 'this-month', now);
    expect(filtered.map((task) => task.id)).toEqual(['recent']);
  });

  it('returns all tasks for all-time window', () => {
    const tasks = [
      makeTask({ id: 'a', updatedAt: '2025-01-01T00:00:00.000Z' }),
      makeTask({ id: 'b', updatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const filtered = filterTasksForInsightsWindow(tasks, 'all-time', now);
    expect(filtered).toHaveLength(2);
  });
});

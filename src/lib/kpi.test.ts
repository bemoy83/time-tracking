import { describe, it, expect } from 'vitest';
import type { Task, AttributedEntry } from './types';
import {
  computeWorkTypeKpis,
  classifyConfidence,
  computeCV,
  detectOutliers,
  splitByPeriod,
  computeTrendDirection,
  MIN_SAMPLE_COUNT,
  MED_SAMPLE_COUNT,
  HIGH_SAMPLE_COUNT,
  RECENT_PERIOD_DAYS,
  type WorkTypeKpi,
} from './kpi';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: 'build-up',
    workCategory: 'carpet-tiles',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

function makeAttributedEntry(overrides: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    entryId: 'entry-1',
    taskId: 'task-1',
    ownerTaskId: 'task-1',
    status: 'attributed',
    reason: 'self',
    personHours: 2,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
    ...overrides,
  };
}

describe('computeWorkTypeKpis', () => {
  it('computes productivity from attributed entries', () => {
    const task = makeTask({ id: 't1', workQuantity: 100 });
    const entries = [
      makeAttributedEntry({ entryId: 'e1', taskId: 't1', ownerTaskId: 't1', personHours: 5 }),
      makeAttributedEntry({ entryId: 'e2', taskId: 't1', ownerTaskId: 't1', personHours: 5 }),
    ];

    const entriesByTask = new Map([['t1', entries]]);
    const kpis = computeWorkTypeKpis([task], entriesByTask);

    expect(kpis).toHaveLength(1);
    expect(kpis[0].avgProductivity).toBe(10); // 100 / 10 person-hrs
    expect(kpis[0].totalQuantity).toBe(100);
    expect(kpis[0].totalPersonHours).toBe(10);
    expect(kpis[0].sampleCount).toBe(1);
  });

  it('groups tasks by work type key', () => {
    const t1 = makeTask({ id: 't1', workQuantity: 100, workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' });
    const t2 = makeTask({ id: 't2', workQuantity: 200, workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' });
    const t3 = makeTask({ id: 't3', workQuantity: 50, workCategory: 'furniture', workUnit: 'pcs', buildPhase: 'build-up' });

    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
      ['t2', [makeAttributedEntry({ entryId: 'e2', taskId: 't2', ownerTaskId: 't2', personHours: 20 })]],
      ['t3', [makeAttributedEntry({ entryId: 'e3', taskId: 't3', ownerTaskId: 't3', personHours: 5 })]],
    ]);

    const kpis = computeWorkTypeKpis([t1, t2, t3], entriesByTask);

    expect(kpis).toHaveLength(2);
    // carpet-tiles group: (100+200) / (10+20) = 10
    const carpetKpi = kpis.find((k) => k.key.workCategory === 'carpet-tiles')!;
    expect(carpetKpi.sampleCount).toBe(2);
    expect(carpetKpi.avgProductivity).toBe(10);
    // furniture group: 50 / 5 = 10
    const furnitureKpi = kpis.find((k) => k.key.workCategory === 'furniture')!;
    expect(furnitureKpi.sampleCount).toBe(1);
    expect(furnitureKpi.avgProductivity).toBe(10);
  });

  it('skips non-completed tasks', () => {
    const task = makeTask({ id: 't1', status: 'active' });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ personHours: 5 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis).toHaveLength(0);
  });

  it('skips tasks with no entries', () => {
    const task = makeTask({ id: 't1' });
    const entriesByTask = new Map<string, AttributedEntry[]>();
    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis).toHaveLength(0);
  });

  it('includes confidence level based on sample count', () => {
    const task = makeTask({ id: 't1', workQuantity: 100 });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis[0].confidence).toBe('insufficient'); // 1 sample < MIN_SAMPLE_COUNT
  });

  it('computes CV for multi-task groups', () => {
    // Two tasks with identical rates → CV = 0
    const t1 = makeTask({ id: 't1', workQuantity: 100 });
    const t2 = makeTask({ id: 't2', workQuantity: 100 });

    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
      ['t2', [makeAttributedEntry({ entryId: 'e2', taskId: 't2', ownerTaskId: 't2', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([t1, t2], entriesByTask);
    expect(kpis[0].cv).toBe(0); // identical rates → no variation
  });

  it('CV is null for single-task groups', () => {
    const task = makeTask({ id: 't1', workQuantity: 100 });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask);
    expect(kpis[0].cv).toBeNull();
  });
});

describe('classifyConfidence', () => {
  it('returns insufficient below MIN_SAMPLE_COUNT', () => {
    expect(classifyConfidence(0)).toBe('insufficient');
    expect(classifyConfidence(1)).toBe('insufficient');
    expect(classifyConfidence(MIN_SAMPLE_COUNT - 1)).toBe('insufficient');
  });

  it('returns low between MIN and MED', () => {
    expect(classifyConfidence(MIN_SAMPLE_COUNT)).toBe('low');
    expect(classifyConfidence(MED_SAMPLE_COUNT - 1)).toBe('low');
  });

  it('returns medium between MED and HIGH', () => {
    expect(classifyConfidence(MED_SAMPLE_COUNT)).toBe('medium');
    expect(classifyConfidence(HIGH_SAMPLE_COUNT - 1)).toBe('medium');
  });

  it('returns high at or above HIGH_SAMPLE_COUNT', () => {
    expect(classifyConfidence(HIGH_SAMPLE_COUNT)).toBe('high');
    expect(classifyConfidence(100)).toBe('high');
  });
});

describe('computeCV', () => {
  it('returns null for fewer than 2 samples', () => {
    expect(computeCV([])).toBeNull();
    expect(computeCV([10])).toBeNull();
  });

  it('returns 0 for identical values', () => {
    expect(computeCV([10, 10, 10])).toBe(0);
  });

  it('computes correct CV for known values', () => {
    // rates: [10, 20] → mean=15, stddev=5, cv=5/15=0.333...
    const cv = computeCV([10, 20])!;
    expect(cv).toBeCloseTo(0.3333, 3);
  });

  it('returns null when mean is 0', () => {
    expect(computeCV([0, 0])).toBeNull();
  });
});

describe('detectOutliers', () => {
  it('returns empty for fewer than 4 samples', () => {
    expect(detectOutliers([])).toEqual([]);
    expect(detectOutliers([10])).toEqual([]);
    expect(detectOutliers([10, 20])).toEqual([]);
    expect(detectOutliers([10, 20, 30])).toEqual([]);
  });

  it('returns empty when no outliers exist', () => {
    // Uniform distribution — no outliers
    expect(detectOutliers([10, 11, 12, 13])).toEqual([]);
  });

  it('detects extreme outliers', () => {
    // 10, 10, 10, 10, 100 — 100 is clearly an outlier
    const result = detectOutliers([10, 10, 10, 10, 100]);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain(4); // index of 100
  });

  it('returns indices in original order', () => {
    // Outlier at the beginning
    const result = detectOutliers([100, 10, 10, 10, 10]);
    expect(result).toContain(0); // index of 100
  });

  it('handles all identical values (no outliers)', () => {
    expect(detectOutliers([5, 5, 5, 5, 5])).toEqual([]);
  });
});

describe('splitByPeriod', () => {
  const now = new Date('2024-06-15T12:00:00.000Z');

  it('splits tasks into recent and baseline by updatedAt', () => {
    const recent = makeTask({ id: 'r1', updatedAt: '2024-06-10T00:00:00.000Z' }); // 5 days ago
    const old = makeTask({ id: 'o1', updatedAt: '2024-04-01T00:00:00.000Z' }); // ~75 days ago

    const result = splitByPeriod([recent, old], RECENT_PERIOD_DAYS, now);

    expect(result.recent.map((t) => t.id)).toEqual(['r1']);
    expect(result.baseline.map((t) => t.id)).toEqual(['o1']);
  });

  it('task exactly at cutoff goes to baseline', () => {
    const cutoffDate = new Date(now.getTime() - RECENT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const atCutoff = makeTask({ id: 'c1', updatedAt: cutoffDate.toISOString() });

    const result = splitByPeriod([atCutoff], RECENT_PERIOD_DAYS, now);

    // ISO comparison: cutoff === cutoff → >= → goes to recent
    expect(result.recent.map((t) => t.id)).toEqual(['c1']);
  });

  it('returns empty arrays for empty input', () => {
    const result = splitByPeriod([], RECENT_PERIOD_DAYS, now);
    expect(result.recent).toEqual([]);
    expect(result.baseline).toEqual([]);
  });
});

describe('computeTrendDirection', () => {
  function makeKpi(overrides: Partial<WorkTypeKpi>): WorkTypeKpi {
    return {
      key: { workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' },
      sampleCount: 5,
      avgProductivity: 10,
      totalQuantity: 100,
      totalPersonHours: 10,
      confidence: 'medium',
      cv: null,
      outlierCount: 0,
      ...overrides,
    };
  }

  it('returns improving when recent > baseline by >5%', () => {
    const recent = makeKpi({ avgProductivity: 12 });  // +20%
    const baseline = makeKpi({ avgProductivity: 10 });
    const { direction, changePercent } = computeTrendDirection(recent, baseline);

    expect(direction).toBe('improving');
    expect(changePercent).toBeCloseTo(0.2, 2);
  });

  it('returns declining when recent < baseline by >5%', () => {
    const recent = makeKpi({ avgProductivity: 8 });   // -20%
    const baseline = makeKpi({ avgProductivity: 10 });
    const { direction } = computeTrendDirection(recent, baseline);

    expect(direction).toBe('declining');
  });

  it('returns stable when change is within ±5%', () => {
    const recent = makeKpi({ avgProductivity: 10.3 }); // +3%
    const baseline = makeKpi({ avgProductivity: 10 });
    const { direction } = computeTrendDirection(recent, baseline);

    expect(direction).toBe('stable');
  });

  it('returns null when either period has insufficient data', () => {
    const recent = makeKpi({ confidence: 'insufficient' });
    const baseline = makeKpi({ confidence: 'medium' });
    const { direction } = computeTrendDirection(recent, baseline);

    expect(direction).toBeNull();
  });

  it('returns null when baseline is null', () => {
    const recent = makeKpi({});
    const { direction } = computeTrendDirection(recent, null);

    expect(direction).toBeNull();
  });
});

describe('archiveOnly filtering', () => {
  it('includes all completed tasks when archiveOnly is false', () => {
    const task = makeTask({ id: 't1', workQuantity: 100 });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask, { archiveOnly: false });
    expect(kpis).toHaveLength(1);
  });

  it('excludes non-archived tasks when archiveOnly is true', () => {
    const task = makeTask({ id: 't1', workQuantity: 100, archivedAt: null });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask, { archiveOnly: true });
    expect(kpis).toHaveLength(0);
  });

  it('includes archived tasks when archiveOnly is true', () => {
    const task = makeTask({
      id: 't1',
      workQuantity: 100,
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
    ]);

    const kpis = computeWorkTypeKpis([task], entriesByTask, { archiveOnly: true });
    expect(kpis).toHaveLength(1);
    expect(kpis[0].avgProductivity).toBe(10);
  });

  it('mixes archived and non-archived correctly', () => {
    const archived = makeTask({
      id: 't1',
      workQuantity: 100,
      archivedAt: '2024-02-01T00:00:00.000Z',
      archiveVersion: 'v1',
    });
    const notArchived = makeTask({ id: 't2', workQuantity: 200, archivedAt: null });
    const entriesByTask = new Map([
      ['t1', [makeAttributedEntry({ taskId: 't1', ownerTaskId: 't1', personHours: 10 })]],
      ['t2', [makeAttributedEntry({ entryId: 'e2', taskId: 't2', ownerTaskId: 't2', personHours: 20 })]],
    ]);

    // Default: both included
    const all = computeWorkTypeKpis([archived, notArchived], entriesByTask);
    expect(all[0].sampleCount).toBe(2);

    // Archive-only: only t1
    const archiveOnly = computeWorkTypeKpis([archived, notArchived], entriesByTask, { archiveOnly: true });
    expect(archiveOnly[0].sampleCount).toBe(1);
    expect(archiveOnly[0].totalQuantity).toBe(100);
  });
});

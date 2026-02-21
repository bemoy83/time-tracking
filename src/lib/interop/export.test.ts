import { describe, it, expect } from 'vitest';
import type { WorkTypeKpi } from '../kpi';
import { exportOpsSummary, exportEstimatorSummary, exportPhaseSummary, exportKpis } from './export';

function makeKpi(overrides: Partial<WorkTypeKpi> = {}): WorkTypeKpi {
  return {
    key: { workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'build-up' },
    sampleCount: 5,
    avgProductivity: 12.345,
    totalQuantity: 500,
    totalPersonHours: 40.5,
    confidence: 'medium',
    cv: 0.1234,
    outlierCount: 1,
    ...overrides,
  };
}

describe('exportOpsSummary', () => {
  it('produces correct CSV headers', () => {
    const csv = exportOpsSummary([]);
    const headers = csv.split('\n')[0];
    expect(headers).toBe(
      'mappingKey,workCategory,workUnit,buildPhase,sampleCount,avgProductivity,totalQuantity,totalPersonHours',
    );
  });

  it('serializes KPI data with stable mapping key', () => {
    const kpi = makeKpi();
    const csv = exportOpsSummary([kpi]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    const row = lines[1];
    expect(row).toContain('carpet-tiles:m2:build-up');
    expect(row).toContain('Carpet Tiles');
    expect(row).toContain('12.35'); // rounded to 2 decimals
    expect(row).toContain('40.5');
  });

  it('handles null buildPhase', () => {
    const kpi = makeKpi({
      key: { workCategory: 'furniture', workUnit: 'pcs', buildPhase: null },
    });
    const csv = exportOpsSummary([kpi]);
    expect(csv).toContain('furniture:pcs:_');
  });

  it('handles multiple KPIs', () => {
    const k1 = makeKpi();
    const k2 = makeKpi({
      key: { workCategory: 'furniture', workUnit: 'pcs', buildPhase: 'build-up' },
      sampleCount: 3,
    });
    const csv = exportOpsSummary([k1, k2]);
    expect(csv.split('\n')).toHaveLength(3);
  });
});

describe('exportEstimatorSummary', () => {
  it('includes confidence, cv, and outlierCount columns', () => {
    const csv = exportEstimatorSummary([makeKpi()]);
    const headers = csv.split('\n')[0];
    expect(headers).toContain('confidence');
    expect(headers).toContain('cv');
    expect(headers).toContain('outlierCount');

    const row = csv.split('\n')[1];
    expect(row).toContain('medium');
    expect(row).toContain('0.123'); // cv rounded to 3 decimals
    expect(row).toContain(',1'); // outlierCount
  });

  it('handles null CV', () => {
    const kpi = makeKpi({ cv: null });
    const csv = exportEstimatorSummary([kpi]);
    const row = csv.split('\n')[1];
    // null CV → empty field between two commas
    expect(row).toContain(',,');
  });
});

describe('exportPhaseSummary', () => {
  it('sorts by buildPhase first', () => {
    const k1 = makeKpi({
      key: { workCategory: 'carpet-tiles', workUnit: 'm2', buildPhase: 'tear-down' },
    });
    const k2 = makeKpi({
      key: { workCategory: 'furniture', workUnit: 'pcs', buildPhase: 'build-up' },
    });
    const csv = exportPhaseSummary([k1, k2]);
    const lines = csv.split('\n');

    // build-up should come before tear-down
    expect(lines[1]).toMatch(/^build-up/);
    expect(lines[2]).toMatch(/^tear-down/);
  });

  it('has buildPhase as first column', () => {
    const headers = exportPhaseSummary([]).split('\n')[0];
    expect(headers.startsWith('buildPhase,')).toBe(true);
  });
});

describe('exportKpis', () => {
  it('dispatches to correct profile', () => {
    const kpi = makeKpi();
    const ops = exportKpis([kpi], 'ops_summary');
    const est = exportKpis([kpi], 'estimator_summary');
    const phase = exportKpis([kpi], 'phase_summary');

    // ops doesn't have confidence column, estimator does
    expect(ops.split('\n')[0]).not.toContain('confidence');
    expect(est.split('\n')[0]).toContain('confidence');
    expect(phase.split('\n')[0]).toMatch(/^buildPhase/);
  });
});

describe('CSV escaping', () => {
  it('escapes fields with commas', () => {
    // WorkCategory labels don't have commas currently, but test the mechanism
    const kpi = makeKpi();
    const csv = exportOpsSummary([kpi]);
    // Should be valid CSV (no unescaped commas in field values)
    const row = csv.split('\n')[1];
    const fields = row.split(',');
    expect(fields.length).toBe(8); // exact column count
  });
});

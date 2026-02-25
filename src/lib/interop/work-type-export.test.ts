import { describe, expect, it } from 'vitest';
import type { WorkType } from '../types';
import { exportWorkTypesCsv } from './work-type-export';

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    expectedProductivity: 9.5,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportWorkTypesCsv', () => {
  it('exports headers and definition fields', () => {
    const csv = exportWorkTypesCsv([makeWorkType()]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('mappingKey,title,workUnit,buildPhase,expectedProductivity');
    expect(lines[1]).toContain('carpet tiles:m2:build-up');
    expect(lines[1]).toContain('Carpet Tiles,m2,build-up,9.5');
  });

  it('escapes CSV values with commas and quotes', () => {
    const csv = exportWorkTypesCsv([
      makeWorkType({ title: 'Walls, "A" zone' }),
    ]);

    expect(csv).toContain('"Walls, ""A"" zone"');
  });

  it('uses normalized mapping key from title/workUnit/buildPhase', () => {
    const csv = exportWorkTypesCsv([
      makeWorkType({ title: '  Carpet   Tiles  ' }),
    ]);

    expect(csv.split('\n')[1]).toContain('carpet tiles:m2:build-up');
  });

  it('returns header-only CSV for empty list', () => {
    expect(exportWorkTypesCsv([])).toBe('mappingKey,title,workUnit,buildPhase,expectedProductivity');
  });
});

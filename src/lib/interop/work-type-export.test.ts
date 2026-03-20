import { describe, expect, it } from 'vitest';
import type { WorkType } from '../types';
import { exportWorkTypesCsv } from './work-type-export';

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    assemblyRate: 9.5,
    dismantleRate: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportWorkTypesCsv', () => {
  it('exports headers and definition fields', () => {
    const csv = exportWorkTypesCsv([makeWorkType()]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('mappingKey,title,workUnit,workUnitLabel,assemblyRate,dismantleRate');
    expect(lines[1]).toContain('carpet tiles:m2');
    expect(lines[1]).toContain('Carpet Tiles,m2,m²,9.5,0');
  });

  it('escapes CSV values with commas and quotes', () => {
    const csv = exportWorkTypesCsv([
      makeWorkType({ title: 'Walls, "A" zone' }),
    ]);

    expect(csv).toContain('"Walls, ""A"" zone"');
  });

  it('uses normalized mapping key from title/workUnit', () => {
    const csv = exportWorkTypesCsv([
      makeWorkType({ title: '  Carpet   Tiles  ' }),
    ]);

    expect(csv.split('\n')[1]).toContain('carpet tiles:m2');
  });

  it('returns header-only CSV for empty list', () => {
    expect(exportWorkTypesCsv([])).toBe('mappingKey,title,workUnit,workUnitLabel,assemblyRate,dismantleRate');
  });
});

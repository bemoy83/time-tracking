import { describe, it, expect } from 'vitest';
import { parseWorkPackageCsv, workPackageMappingKey } from './import';

const VALID_HEADER = 'title,workTypeTitle,workUnit,buildPhase,workQuantity,estimatedMinutes,defaultWorkers,targetProductivity';

function csv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

describe('workPackageMappingKey', () => {
  it('generates stable key from fields', () => {
    const key = workPackageMappingKey('Install carpet', 'Carpet Tiles', 'm2', 'build-up');
    expect(key).toBe('Install carpet::Carpet Tiles:m2:build-up');
  });
});

describe('parseWorkPackageCsv', () => {
  it('parses valid CSV row', () => {
    const result = parseWorkPackageCsv(csv([
      'Install carpet,Carpet Tiles,m2,build-up,100,60,2,10',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Install carpet');
    expect(result.items[0].workTypeTitle).toBe('Carpet Tiles');
    expect(result.items[0].workUnit).toBe('m2');
    expect(result.items[0].buildPhase).toBe('build-up');
    expect(result.items[0].workQuantity).toBe(100);
    expect(result.items[0].estimatedMinutes).toBe(60);
    expect(result.items[0].defaultWorkers).toBe(2);
    expect(result.items[0].targetProductivity).toBe(10);
  });

  it('handles optional fields as null', () => {
    const result = parseWorkPackageCsv(csv([
      'Install carpet,Carpet Tiles,m2,build-up,,,,',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items[0].workQuantity).toBeNull();
    expect(result.items[0].estimatedMinutes).toBeNull();
    expect(result.items[0].defaultWorkers).toBeNull();
    expect(result.items[0].targetProductivity).toBeNull();
  });

  it('generates mapping key for round-trip', () => {
    const result = parseWorkPackageCsv(csv([
      'Install carpet,Carpet Tiles,m2,build-up,100,,,',
    ]));

    expect(result.items[0].mappingKey).toBe('Install carpet::Carpet Tiles:m2:build-up');
  });

  it('parses semicolon-delimited CSV (e.g. European Excel)', () => {
    const semicolonCsv = [
      'title;workTypeTitle;workUnit;buildPhase;workQuantity;estimatedMinutes;defaultWorkers;targetProductivity',
      'Install carpet;Carpet Tiles;m2;build-up;100;60;2;10',
    ].join('\n');
    const result = parseWorkPackageCsv(semicolonCsv);

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Install carpet');
    expect(result.items[0].workTypeTitle).toBe('Carpet Tiles');
    expect(result.items[0].workUnit).toBe('m2');
    expect(result.items[0].buildPhase).toBe('build-up');
    expect(result.items[0].workQuantity).toBe(100);
  });

  it('rejects missing required headers', () => {
    const result = parseWorkPackageCsv('title,workUnit\nFoo,m2');

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Missing required headers');
  });

  it('requires workTypeTitle header', () => {
    const result = parseWorkPackageCsv([
      'title,workUnit,buildPhase,workQuantity,estimatedMinutes,defaultWorkers,targetProductivity',
      'Task,m2,build-up,,,,',
    ].join('\n'));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('headers');
  });

  it('rejects invalid workUnit', () => {
    const result = parseWorkPackageCsv(csv([
      'Task,Carpet Tiles,invalid,build-up,,,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('workUnit');
  });

  it('rejects invalid buildPhase', () => {
    const result = parseWorkPackageCsv(csv([
      'Task,Carpet Tiles,m2,invalid-phase,,,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('buildPhase');
  });

  it('rejects non-numeric values for numeric fields', () => {
    const result = parseWorkPackageCsv(csv([
      'Task,Carpet Tiles,m2,build-up,abc,,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('workQuantity');
    expect(result.errors[0].message).toContain('not a valid number');
  });

  it('rejects negative workQuantity', () => {
    const result = parseWorkPackageCsv(csv([
      'Task,Carpet Tiles,m2,build-up,-10,,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('workQuantity');
  });

  it('rejects defaultWorkers out of range', () => {
    const result = parseWorkPackageCsv(csv([
      'Task,Carpet Tiles,m2,build-up,100,,25,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('defaultWorkers');
  });

  it('rejects missing title', () => {
    const result = parseWorkPackageCsv(csv([
      ',Carpet Tiles,m2,build-up,,,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('title');
  });

  it('parses multiple rows', () => {
    const result = parseWorkPackageCsv(csv([
      'Task A,Carpet Tiles,m2,build-up,100,,,',
      'Task B,Furniture,pcs,build-up,50,,,',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('skips empty lines', () => {
    const result = parseWorkPackageCsv(csv([
      'Task A,Carpet Tiles,m2,build-up,100,,,',
      '',
      'Task B,Furniture,pcs,build-up,50,,,',
    ]));

    expect(result.items).toHaveLength(2);
  });

  it('handles quoted fields with commas', () => {
    const result = parseWorkPackageCsv(csv([
      '"Install carpet, phase 1",Carpet Tiles,m2,build-up,100,,,',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items[0].title).toBe('Install carpet, phase 1');
  });

  it('rejects CSV with only headers', () => {
    const result = parseWorkPackageCsv(VALID_HEADER);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('at least one data row');
  });

  it('collects multiple errors per row', () => {
    const result = parseWorkPackageCsv(csv([
      ',invalid,bad-unit,bad-phase,,,,',
    ]));

    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

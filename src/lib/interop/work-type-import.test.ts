import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkType } from '../types';
import {
  applyWorkTypeImport,
  generateWorkTypeImportPreview,
  parseWorkTypeCsv,
} from './work-type-import';
import {
  createWorkType,
  findWorkTypeByKey,
  updateWorkTypeFields,
} from '../stores/work-type-store';

vi.mock('../stores/work-type-store', () => ({
  createWorkType: vi.fn(),
  findWorkTypeByKey: vi.fn(),
  updateWorkTypeFields: vi.fn(),
}));

vi.mock('../stores/work-unit-store', () => ({
  ensureImportedWorkUnits: vi.fn(async () => ({ created: [], relabeled: [] })),
}));

const mockCreateWorkType = vi.mocked(createWorkType);
const mockFindWorkTypeByKey = vi.mocked(findWorkTypeByKey);
const mockUpdateWorkTypeFields = vi.mocked(updateWorkTypeFields);

const VALID_HEADER = 'title,workUnit,workUnitLabel,assemblyRate,dismantleRate';

function csv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    assemblyRate: 10,
    dismantleRate: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateWorkType.mockReset();
  mockFindWorkTypeByKey.mockReset();
  mockUpdateWorkTypeFields.mockReset();
});

describe('parseWorkTypeCsv', () => {
  it('skips rows with both rates 0 and records a warning without failing parse', () => {
    const result = parseWorkTypeCsv(csv([
      'Skip Me,m2,m²,0,0',
      'Keep Me,pcs,pcs,5,0',
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ row: 2, field: 'rates' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Keep Me');
  });

  it('still errors when both rates are 0 but title or unit is invalid', () => {
    const result = parseWorkTypeCsv(csv([',m2,m²,0,0']));

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'title')).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.items).toHaveLength(0);
  });

  it('parses a valid row with mapping key', () => {
    const result = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,m²,11.5,3',
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      mappingKey: 'carpet tiles:m2',
      title: 'Carpet Tiles',
      workUnit: 'm2',
      workUnitLabel: 'm²',
      assemblyRate: 11.5,
      dismantleRate: 3,
    });
  });

  it('requires assemblyRate and dismantleRate headers', () => {
    const result = parseWorkTypeCsv('title,workUnit\nCarpet Tiles,m2');

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('headers');
    expect(result.errors[0].message).toContain('assemblyrate');
  });

  it('rejects malformed ids and rates', () => {
    const result = parseWorkTypeCsv(csv([
      'Carpet Tiles,Bad Unit,, -2,-3',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'workUnit')).toBe(true);
    expect(result.errors.some((error) => error.field === 'assemblyRate')).toBe(true);
  });

  it('handles quoted values', () => {
    const result = parseWorkTypeCsv(csv([
      '"Walls, phase 1",m,m,4,2',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items[0].title).toBe('Walls, phase 1');
  });

  it('parses semicolon-delimited CSV (e.g. European Excel)', () => {
    const semicolonCsv = [
      'title;workUnit;workUnitLabel;assemblyRate;dismantleRate',
      'Carpet Tiles;m2;m²;11.5;3',
    ].join('\n');
    const result = parseWorkTypeCsv(semicolonCsv);

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'Carpet Tiles',
      workUnit: 'm2',
      assemblyRate: 11.5,
      dismantleRate: 3,
    });
  });

  it('accepts European decimal format (comma as decimal separator)', () => {
    const semicolonCsv = [
      'title;workUnit;workUnitLabel;assemblyRate;dismantleRate',
      'Carpet Tiles;m2;m²;11,5;3',
    ].join('\n');
    const result = parseWorkTypeCsv(semicolonCsv);

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'Carpet Tiles',
      workUnit: 'm2',
      assemblyRate: 11.5,
      dismantleRate: 3,
    });
  });
});

describe('generateWorkTypeImportPreview', () => {
  it('marks create and update actions by composite key', () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,m²,12,3',
      'Furniture,pcs,pcs,5,2',
    ]));

    const existing = [makeWorkType({ title: 'Carpet Tiles', workUnit: 'm2' })];
    const preview = generateWorkTypeImportPreview(parsed.items, existing);

    expect(preview.summary).toEqual({ create: 1, update: 1 });
    expect(preview.items[0].action).toBe('update');
    expect(preview.items[1].action).toBe('create');
    expect(preview.duplicateKeys).toEqual([]);
  });

  it('detects duplicate mapping keys within import set', () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,m²,12,3',
      'Carpet Tiles,m2,m²,14,5',
      'Furniture,pcs,pcs,5,2',
    ]));

    const preview = generateWorkTypeImportPreview(parsed.items, []);

    expect(preview.duplicateKeys).toContain('carpet tiles:m2');
    expect(preview.duplicateKeys).toHaveLength(1);
  });
});

describe('applyWorkTypeImport', () => {
  it('updates when key exists and creates when missing', async () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,m²,14,3',
      'Furniture,pcs,pcs,6,2',
    ]));

    mockFindWorkTypeByKey
      .mockReturnValueOnce(makeWorkType({ id: 'wt-existing', title: 'Carpet Tiles' }))
      .mockReturnValueOnce(undefined);
    mockCreateWorkType.mockResolvedValue(makeWorkType({ id: 'wt-created', title: 'Furniture', workUnit: 'pcs', assemblyRate: 6, dismantleRate: 2 }));

    const result = await applyWorkTypeImport(parsed.items);

    expect(result).toEqual({
      created: 1,
      updated: 1,
      unitsCreated: 0,
      unitLabelsUpdated: 0,
    });
    expect(mockUpdateWorkTypeFields).toHaveBeenCalledWith('wt-existing', {
      title: 'Carpet Tiles',
      workUnit: 'm2',
      assemblyRate: 14,
      dismantleRate: 3,
    });
    expect(mockCreateWorkType).toHaveBeenCalledWith({
      title: 'Furniture',
      workUnit: 'pcs',
      assemblyRate: 6,
      dismantleRate: 2,
    });
  });
});

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

const mockCreateWorkType = vi.mocked(createWorkType);
const mockFindWorkTypeByKey = vi.mocked(findWorkTypeByKey);
const mockUpdateWorkTypeFields = vi.mocked(updateWorkTypeFields);

const VALID_HEADER = 'title,workUnit,buildPhase,expectedProductivity';

function csv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    expectedProductivity: 10,
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
  it('parses a valid row with mapping key', () => {
    const result = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,build-up,11.5',
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      mappingKey: 'carpet tiles:m2:build-up',
      title: 'Carpet Tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
      expectedProductivity: 11.5,
    });
  });

  it('requires expectedProductivity header', () => {
    const result = parseWorkTypeCsv('title,workUnit,buildPhase\nCarpet Tiles,m2,build-up');

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('headers');
    expect(result.errors[0].message).toContain('expectedproductivity');
  });

  it('validates enum fields and positive expectedProductivity', () => {
    const result = parseWorkTypeCsv(csv([
      'Carpet Tiles,invalid,wrong,-2',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'workUnit')).toBe(true);
    expect(result.errors.some((error) => error.field === 'buildPhase')).toBe(true);
    expect(result.errors.some((error) => error.field === 'expectedProductivity')).toBe(true);
  });

  it('handles quoted values', () => {
    const result = parseWorkTypeCsv(csv([
      '"Walls, phase 1",m,tear-down,4',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items[0].title).toBe('Walls, phase 1');
  });

  it('parses semicolon-delimited CSV (e.g. European Excel)', () => {
    const semicolonCsv = [
      'title;workUnit;buildPhase;expectedProductivity',
      'Carpet Tiles;m2;build-up;11.5',
    ].join('\n');
    const result = parseWorkTypeCsv(semicolonCsv);

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'Carpet Tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
      expectedProductivity: 11.5,
    });
  });
});

describe('generateWorkTypeImportPreview', () => {
  it('marks create and update actions by composite key', () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,build-up,12',
      'Furniture,pcs,tear-down,5',
    ]));

    const existing = [makeWorkType({ title: 'Carpet Tiles', workUnit: 'm2', buildPhase: 'build-up' })];
    const preview = generateWorkTypeImportPreview(parsed.items, existing);

    expect(preview.summary).toEqual({ create: 1, update: 1 });
    expect(preview.items[0].action).toBe('update');
    expect(preview.items[1].action).toBe('create');
    expect(preview.duplicateKeys).toEqual([]);
  });

  it('detects duplicate mapping keys within import set', () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,build-up,12',
      'Carpet Tiles,m2,build-up,14',
      'Furniture,pcs,tear-down,5',
    ]));

    const preview = generateWorkTypeImportPreview(parsed.items, []);

    expect(preview.duplicateKeys).toContain('carpet tiles:m2:build-up');
    expect(preview.duplicateKeys).toHaveLength(1);
  });
});

describe('applyWorkTypeImport', () => {
  it('updates when key exists and creates when missing', async () => {
    const parsed = parseWorkTypeCsv(csv([
      'Carpet Tiles,m2,build-up,14',
      'Furniture,pcs,build-up,6',
    ]));

    mockFindWorkTypeByKey
      .mockReturnValueOnce(makeWorkType({ id: 'wt-existing', title: 'Carpet Tiles' }))
      .mockReturnValueOnce(undefined);
    mockCreateWorkType.mockResolvedValue(makeWorkType({ id: 'wt-created', title: 'Furniture', workUnit: 'pcs', expectedProductivity: 6 }));

    const result = await applyWorkTypeImport(parsed.items);

    expect(result).toEqual({ created: 1, updated: 1 });
    expect(mockUpdateWorkTypeFields).toHaveBeenCalledWith('wt-existing', {
      title: 'Carpet Tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
      expectedProductivity: 14,
    });
    expect(mockCreateWorkType).toHaveBeenCalledWith({
      title: 'Furniture',
      workUnit: 'pcs',
      buildPhase: 'build-up',
      expectedProductivity: 6,
    });
  });
});

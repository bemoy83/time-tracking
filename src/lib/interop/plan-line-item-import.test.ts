import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findWorkTypeByKey } from '../stores/work-type-store';
import {
  parsePlanLineItemCsv,
  importedPlanLineItemsToLineItems,
  type ImportedPlanLineItem,
} from './plan-line-item-import';

vi.mock('../stores/work-type-store', () => ({
  findWorkTypeByKey: vi.fn(),
}));

const mockFindWorkTypeByKey = vi.mocked(findWorkTypeByKey);

const VALID_HEADER = 'title,workTypeTitle,workUnit,workQuantity,assemblyRate,assemblyCrew,assemblyEstimatedMinutes,dismantleRate,dismantleCrew,dismantleEstimatedMinutes';

function csv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

function makeImported(overrides: Partial<ImportedPlanLineItem> = {}): ImportedPlanLineItem {
  return {
    mappingKey: 'flooring::carpet tiles:m2',
    title: 'Flooring',
    workTypeTitle: 'Carpet Tiles',
    workUnit: 'm2',
    workTypeId: 'wt-1',
    workQuantity: 100,
    assemblyRate: 10,
    assemblyCrew: null,
    assemblyEstimatedMinutes: null,
    dismantleRate: 5,
    dismantleCrew: null,
    dismantleEstimatedMinutes: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFindWorkTypeByKey.mockReset();
  mockFindWorkTypeByKey.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// parsePlanLineItemCsv
// ---------------------------------------------------------------------------

describe('parsePlanLineItemCsv', () => {
  it('returns an error for a CSV with only a header row', () => {
    const result = parsePlanLineItemCsv(VALID_HEADER);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('csv');
  });

  it('returns an error when required headers are missing', () => {
    const result = parsePlanLineItemCsv('title,workUnit\nFlooring,m2');
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('headers');
    expect(result.errors[0].message).toContain('worktypetitle');
  });

  it('parses a valid dual-phase row', () => {
    mockFindWorkTypeByKey.mockReturnValue({ id: 'wt-1' } as never);
    const result = parsePlanLineItemCsv(csv([
      'Flooring,Carpet Tiles,m2,100,10,3,600,5,2,300',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'Flooring',
      workTypeTitle: 'Carpet Tiles',
      workUnit: 'm2',
      workQuantity: 100,
      assemblyRate: 10,
      assemblyCrew: 3,
      assemblyEstimatedMinutes: 600,
      dismantleRate: 5,
      dismantleCrew: 2,
      dismantleEstimatedMinutes: 300,
      workTypeId: 'wt-1',
    });
  });

  it('parses an assembly-only row (dismantle fields absent)', () => {
    const result = parsePlanLineItemCsv(
      'title,workTypeTitle,workUnit,workQuantity,assemblyRate\nFlooring,Carpet Tiles,m2,100,10',
    );

    expect(result.valid).toBe(true);
    expect(result.items[0]).toMatchObject({
      assemblyRate: 10,
      dismantleRate: 0,
      assemblyCrew: null,
      dismantleCrew: null,
      assemblyEstimatedMinutes: null,
      dismantleEstimatedMinutes: null,
    });
  });

  it('sets workTypeId to null when work type not found', () => {
    mockFindWorkTypeByKey.mockReturnValue(undefined);
    const result = parsePlanLineItemCsv(csv(['Flooring,Carpet Tiles,m2,100,10,,,5,,']));

    expect(result.valid).toBe(true);
    expect(result.items[0].workTypeId).toBeNull();
  });

  it('rejects an invalid work unit', () => {
    const result = parsePlanLineItemCsv(csv(['Flooring,Carpet Tiles,badunit,100,10,,,5,,']));
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('workUnit');
  });

  it('rejects a missing title', () => {
    const result = parsePlanLineItemCsv(csv([',Carpet Tiles,m2,100,10,,,5,,']));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'title')).toBe(true);
  });

  it('skips blank lines', () => {
    const result = parsePlanLineItemCsv(csv([
      'Flooring,Carpet Tiles,m2,100,10,,,5,,',
      '',
      'Staging,Staging,pcs,50,8,,,4,,',
    ]));

    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('auto-detects semicolon delimiter', () => {
    const semicolonCsv = 'title;workTypeTitle;workUnit;workQuantity;assemblyRate\nFlooring;Carpet Tiles;m2;100;10';
    const result = parsePlanLineItemCsv(semicolonCsv);
    expect(result.valid).toBe(true);
    expect(result.items[0].assemblyRate).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// importedPlanLineItemsToLineItems
// ---------------------------------------------------------------------------

describe('importedPlanLineItemsToLineItems', () => {
  it('auto-computes assemblyTimeHours from rate when estimatedMinutes not provided', () => {
    // workQuantity=100, assemblyRate=10 → 100/10 = 10h
    const items = importedPlanLineItemsToLineItems([
      makeImported({ workQuantity: 100, assemblyRate: 10, assemblyEstimatedMinutes: null }),
    ]);
    expect(items[0].assemblyTimeHours).toBeCloseTo(10);
  });

  it('overrides assemblyTimeHours with estimatedMinutes when provided', () => {
    // 480 minutes = 8h (ignoring rate-computed value)
    const items = importedPlanLineItemsToLineItems([
      makeImported({ workQuantity: 100, assemblyRate: 10, assemblyEstimatedMinutes: 480 }),
    ]);
    expect(items[0].assemblyTimeHours).toBeCloseTo(8);
  });

  it('auto-computes dismantleTimeHours from rate when estimatedMinutes not provided', () => {
    // workQuantity=100, dismantleRate=5 → 100/5 = 20h
    const items = importedPlanLineItemsToLineItems([
      makeImported({ workQuantity: 100, dismantleRate: 5, dismantleEstimatedMinutes: null }),
    ]);
    expect(items[0].dismantleTimeHours).toBeCloseTo(20);
  });

  it('overrides dismantleTimeHours with estimatedMinutes when provided', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ workQuantity: 100, dismantleRate: 5, dismantleEstimatedMinutes: 300 }),
    ]);
    expect(items[0].dismantleTimeHours).toBeCloseTo(5);
  });

  it('sets timeHours to 0 for phases with rate=0 and no estimatedMinutes', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ assemblyRate: 0, assemblyEstimatedMinutes: null }),
    ]);
    expect(items[0].assemblyTimeHours).toBe(0);
  });

  it('uses explicit assemblyCrew when provided', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ assemblyRate: 10, assemblyCrew: 4 }),
    ]);
    expect(items[0].assemblyCrew).toBe(4);
  });

  it('preserves assemblyCrew=0 when explicitly set', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ assemblyRate: 10, assemblyCrew: 0 }),
    ]);
    expect(items[0].assemblyCrew).toBe(0);
  });

  it('auto-sets assemblyCrew=1 when rate>0 and crew not provided', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ assemblyRate: 10, assemblyCrew: null }),
    ]);
    expect(items[0].assemblyCrew).toBe(1);
  });

  it('auto-sets assemblyCrew=0 when rate=0 and crew not provided', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ assemblyRate: 0, assemblyCrew: null }),
    ]);
    expect(items[0].assemblyCrew).toBe(0);
  });

  it('uses explicit dismantleCrew when provided', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ dismantleRate: 5, dismantleCrew: 3 }),
    ]);
    expect(items[0].dismantleCrew).toBe(3);
  });

  it('preserves correct identity fields', () => {
    const items = importedPlanLineItemsToLineItems([
      makeImported({ title: 'My WP', workTypeTitle: 'Flooring', workUnit: 'pcs', workTypeId: 'wt-99' }),
    ]);
    expect(items[0].title).toBe('My WP');
    expect(items[0].workTypeTitle).toBe('Flooring');
    expect(items[0].workUnit).toBe('pcs');
    expect(items[0].workTypeId).toBe('wt-99');
  });

  it('returns an item per imported row (no merging)', () => {
    const imported = [
      makeImported({ title: 'A' }),
      makeImported({ title: 'B' }),
      makeImported({ title: 'C' }),
    ];
    const items = importedPlanLineItemsToLineItems(imported);
    expect(items).toHaveLength(3);
  });

  it('each returned item has a unique id', () => {
    const imported = [makeImported({ title: 'A' }), makeImported({ title: 'B' })];
    const items = importedPlanLineItemsToLineItems(imported);
    expect(items[0].id).not.toBe(items[1].id);
  });
});

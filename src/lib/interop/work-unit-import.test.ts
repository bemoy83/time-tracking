import { describe, expect, it, vi } from 'vitest';
import {
  collectWorkUnitRefsFromItems,
  parseWorkUnitReference,
  provisionWorkUnitsForImport,
} from './work-unit-import';

describe('work-unit-import helpers', () => {
  it('parses and normalizes work unit ids with optional labels', () => {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    const result = parseWorkUnitReference('M2', 'm²', 2, errors);

    expect(result).toEqual({
      workUnit: 'm2',
      workUnitLabel: 'm²',
    });
    expect(errors).toEqual([]);
  });

  it('reports invalid work unit ids consistently', () => {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    const result = parseWorkUnitReference('m²', null, 4, errors);

    expect(result).toBeNull();
    expect(errors).toEqual([
      {
        row: 4,
        field: 'workUnit',
        message: 'Invalid work unit: "m²". Use lowercase slug ids like "m2" or "pallets".',
      },
    ]);
  });

  it('collects and provisions unit refs through one shared wrapper', async () => {
    const ensureImportedWorkUnits = vi.fn(async () => ({ created: [], relabeled: [] }));
    const items = [
      { workUnit: 'm2', workUnitLabel: 'm²' },
      { workUnit: 'pallets', workUnitLabel: null },
    ];

    expect(
      collectWorkUnitRefsFromItems(items, (item) => item),
    ).toEqual([
      { id: 'm2', label: 'm²' },
      { id: 'pallets', label: 'pallets' },
    ]);

    await provisionWorkUnitsForImport(
      items,
      (item) => item,
      { applyLabelToExisting: true },
      ensureImportedWorkUnits,
    );

    expect(ensureImportedWorkUnits).toHaveBeenCalledWith(
      [
        { id: 'm2', label: 'm²' },
        { id: 'pallets', label: 'pallets' },
      ],
      { applyLabelToExisting: true },
    );
  });
});

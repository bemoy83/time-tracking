import { describe, expect, it } from 'vitest';
import type { WorkUnitDefinition } from './types';
import {
  buildCreatedWorkUnitDefinition,
  getDefaultWorkUnitIdFromDefinitions,
  getSelectableWorkUnitDefinitionsFromList,
  planImportedWorkUnits,
  reconcileSeededWorkUnitDefinitions,
  reorderDefinitions,
} from './work-unit-domain';

function makeDefinition(overrides: Partial<WorkUnitDefinition> = {}): WorkUnitDefinition {
  return {
    id: 'm2',
    label: 'm²',
    sortIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    builtIn: true,
    ...overrides,
  };
}

describe('work-unit-domain', () => {
  it('reconciles built-in definitions without duplicating existing units', () => {
    const existing = [
      makeDefinition({ id: 'm2', label: 'Square Metres', builtIn: false }),
      makeDefinition({ id: 'pallets', label: 'Pallets', sortIndex: 4, builtIn: false }),
    ];

    const result = reconcileSeededWorkUnitDefinitions(existing, '2026-02-01T00:00:00.000Z');

    expect(result.definitions.map((definition) => definition.id)).toEqual(['m2', 'm', 'pcs', 'orders', 'pallets']);
    expect(result.definitions.find((definition) => definition.id === 'm2')).toMatchObject({
      builtIn: true,
      archivedAt: null,
      label: 'Square Metres',
    });
    expect(result.writes.map((definition) => definition.id)).toEqual(['m2', 'm', 'pcs', 'orders']);
  });

  it('builds created definitions with collision-safe ids', () => {
    const existing = [
      makeDefinition(),
      makeDefinition({ id: 'custom-unit', label: 'Custom Unit', sortIndex: 4, builtIn: false }),
    ];

    const created = buildCreatedWorkUnitDefinition('Custom Unit', existing, '2026-02-01T00:00:00.000Z');

    expect(created.id).toBe('custom-unit-2');
    expect(created.label).toBe('Custom Unit');
    expect(created.builtIn).toBe(false);
  });

  it('plans imported unit creation and relabeling in one pass', () => {
    const existing = [
      makeDefinition(),
      makeDefinition({ id: 'pcs', label: 'pcs', sortIndex: 2 }),
    ];

    const result = planImportedWorkUnits(
      existing,
      [
        { id: 'm2', label: 'm² imported' },
        { id: 'pallets', label: 'Pallets' },
      ],
      { applyLabelToExisting: true },
      '2026-02-01T00:00:00.000Z',
    );

    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({ id: 'pallets', label: 'Pallets' });
    expect(result.relabeled).toHaveLength(1);
    expect(result.relabeled[0]).toMatchObject({ id: 'm2', label: 'm² imported' });
  });

  it('keeps archived current units selectable and computes defaults from active units', () => {
    const definitions = [
      makeDefinition(),
      makeDefinition({
        id: 'legacy',
        label: 'Legacy',
        sortIndex: 1,
        builtIn: false,
        archivedAt: '2026-02-01T00:00:00.000Z',
      }),
      makeDefinition({
        id: 'pcs',
        label: 'pcs',
        sortIndex: 2,
      }),
    ];

    expect(getSelectableWorkUnitDefinitionsFromList(definitions).map((definition) => definition.id)).toEqual(['m2', 'pcs']);
    expect(getSelectableWorkUnitDefinitionsFromList(definitions, 'legacy').map((definition) => definition.id)).toEqual(['m2', 'legacy', 'pcs']);
    expect(getDefaultWorkUnitIdFromDefinitions(definitions)).toBe('m2');
  });

  it('reorders definitions while preserving omitted items at the end', () => {
    const definitions = [
      makeDefinition(),
      makeDefinition({ id: 'm', label: 'm', sortIndex: 1 }),
      makeDefinition({ id: 'pcs', label: 'pcs', sortIndex: 2 }),
    ];

    const reordered = reorderDefinitions(definitions, ['pcs', 'm2'], '2026-02-01T00:00:00.000Z');

    expect(reordered.map((definition) => definition.id)).toEqual(['pcs', 'm2', 'm']);
    expect(reordered[0].sortIndex).toBe(0);
    expect(reordered[1].updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});

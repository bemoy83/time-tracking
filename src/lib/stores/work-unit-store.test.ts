import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkUnitDefinition } from '../types';

const dbMocks = vi.hoisted(() => ({
  addWorkUnitDefinitions: vi.fn(),
  deleteWorkUnitDefinition: vi.fn(),
  getAllPlans: vi.fn(),
  getAllTaskTemplates: vi.fn(),
  getAllTasks: vi.fn(),
  getAllWorkTypes: vi.fn(),
  getAllWorkUnitDefinitions: vi.fn(),
  updateWorkUnitDefinition: vi.fn(),
  updateWorkUnitDefinitions: vi.fn(),
}));

vi.mock('../db', () => ({
  addWorkUnitDefinitions: dbMocks.addWorkUnitDefinitions,
  deleteWorkUnitDefinition: dbMocks.deleteWorkUnitDefinition,
  getAllPlans: dbMocks.getAllPlans,
  getAllTaskTemplates: dbMocks.getAllTaskTemplates,
  getAllTasks: dbMocks.getAllTasks,
  getAllWorkTypes: dbMocks.getAllWorkTypes,
  getAllWorkUnitDefinitions: dbMocks.getAllWorkUnitDefinitions,
  updateWorkUnitDefinition: dbMocks.updateWorkUnitDefinition,
  updateWorkUnitDefinitions: dbMocks.updateWorkUnitDefinitions,
}));

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

async function loadStore() {
  return import('./work-unit-store');
}

beforeEach(() => {
  vi.resetModules();
  Object.values(dbMocks).forEach((mock) => mock.mockReset());
  dbMocks.getAllWorkUnitDefinitions.mockResolvedValue([]);
  dbMocks.getAllTasks.mockResolvedValue([]);
  dbMocks.getAllTaskTemplates.mockResolvedValue([]);
  dbMocks.getAllWorkTypes.mockResolvedValue([]);
  dbMocks.getAllPlans.mockResolvedValue([]);
});

describe('work-unit-store', () => {
  it('seeds built-in definitions when the store is empty', async () => {
    const store = await loadStore();
    await store.initializeWorkUnitStore();

    const snapshot = store.getSnapshot();
    expect(snapshot.definitions.map((definition) => definition.id)).toEqual(['m2', 'm', 'pcs', 'orders']);
    expect(dbMocks.addWorkUnitDefinitions).toHaveBeenCalledTimes(1);
  });

  it('creates slug ids and appends numeric suffixes on collision', async () => {
    dbMocks.getAllWorkUnitDefinitions.mockResolvedValue([
      makeDefinition(),
      makeDefinition({
        id: 'custom-unit',
        label: 'Custom Unit',
        sortIndex: 4,
        builtIn: false,
      }),
    ]);

    const store = await loadStore();
    await store.initializeWorkUnitStore();

    const created = await store.createWorkUnitDefinition('Custom Unit');
    expect(created.id).toBe('custom-unit-2');
  });

  it('blocks deletion when a unit is still referenced and allows archiving instead', async () => {
    dbMocks.getAllWorkUnitDefinitions.mockResolvedValue([
      makeDefinition(),
      makeDefinition({
        id: 'pallets',
        label: 'Pallets',
        sortIndex: 4,
        builtIn: false,
      }),
    ]);
    dbMocks.getAllWorkTypes.mockResolvedValue([
      {
        id: 'wt-1',
        title: 'Inbound',
        workUnit: 'pallets',
        assemblyRate: 1,
        dismantleRate: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const store = await loadStore();
    await store.initializeWorkUnitStore();

    await expect(store.deleteWorkUnitDefinitionById('pallets')).rejects.toThrow(/still in use/i);
    await store.archiveWorkUnitDefinition('pallets');

    expect(dbMocks.updateWorkUnitDefinition).toHaveBeenCalledTimes(1);
  });
});

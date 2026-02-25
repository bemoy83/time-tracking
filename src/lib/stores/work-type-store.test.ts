import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkType } from '../types';

const dbMocks = vi.hoisted(() => ({
  getAllWorkTypes: vi.fn(),
  addWorkType: vi.fn(),
  updateWorkType: vi.fn(),
  deleteWorkType: vi.fn(),
}));

vi.mock('../db', () => ({
  getAllWorkTypes: dbMocks.getAllWorkTypes,
  addWorkType: dbMocks.addWorkType,
  updateWorkType: dbMocks.updateWorkType,
  deleteWorkType: dbMocks.deleteWorkType,
}));

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

async function loadStore() {
  return import('./work-type-store');
}

beforeEach(() => {
  vi.resetModules();
  dbMocks.getAllWorkTypes.mockReset();
  dbMocks.addWorkType.mockReset();
  dbMocks.updateWorkType.mockReset();
  dbMocks.deleteWorkType.mockReset();
});

describe('ensureWorkTypeExistsOrCreate', () => {
  it('returns existing id when work type already exists', async () => {
    const existing = makeWorkType();
    dbMocks.getAllWorkTypes.mockResolvedValue([existing]);

    const store = await loadStore();
    await store.initializeWorkTypeStore();

    const id = await store.ensureWorkTypeExistsOrCreate('Carpet Tiles', 'm2', 'build-up');

    expect(id).toBe(existing.id);
    expect(dbMocks.addWorkType).not.toHaveBeenCalled();
  });

  it('creates a new work type when missing and returns new id', async () => {
    dbMocks.getAllWorkTypes.mockResolvedValue([]);

    const store = await loadStore();
    await store.initializeWorkTypeStore();

    const id = await store.ensureWorkTypeExistsOrCreate('Furniture', 'pcs', 'tear-down');

    expect(dbMocks.addWorkType).toHaveBeenCalledTimes(1);
    const created = dbMocks.addWorkType.mock.calls[0][0] as WorkType;
    expect(created.title).toBe('Furniture');
    expect(created.workUnit).toBe('pcs');
    expect(created.buildPhase).toBe('tear-down');
    expect(created.expectedProductivity).toBe(0);
    expect(id).toBe(created.id);
  });
});

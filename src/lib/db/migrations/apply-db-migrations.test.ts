import { describe, expect, it } from 'vitest';
import { applyDbMigrations } from './apply-db-migrations';

type FakeRecord = Record<string, unknown>;

function createObjectStore(
  records: FakeRecord[],
  indexes: string[] = [],
  operations?: string[],
  name = 'store',
) {
  const indexSet = new Set(indexes);

  const putRecord = (record: FakeRecord) => {
    const key = typeof record.id === 'string' ? record.id : null;
    if (key == null) {
      records.push(record);
      return;
    }
    const existingIndex = records.findIndex((candidate) => candidate.id === key);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
      return;
    }
    records.push(record);
  };

  return {
    records,
    putCalls: [] as FakeRecord[],
    addCalls: [] as FakeRecord[],
    deleteCalls: [] as string[],
    deletedIndexes: [] as string[],
    createdIndexes: [] as Array<[string, string | string[]]>,
    getAll() {
      operations?.push(`getAll:${name}`);
      return Promise.resolve(records);
    },
    put(record: FakeRecord) {
      operations?.push(`put:${name}`);
      this.putCalls.push(record);
      putRecord(record);
      return Promise.resolve(record);
    },
    add(record: FakeRecord) {
      operations?.push(`add:${name}`);
      this.addCalls.push(record);
      putRecord(record);
      return Promise.resolve(record);
    },
    delete(key: string) {
      operations?.push(`delete:${name}`);
      this.deleteCalls.push(key);
      const existingIndex = records.findIndex((candidate) => candidate.id === key);
      if (existingIndex >= 0) {
        records.splice(existingIndex, 1);
      }
      return Promise.resolve(undefined);
    },
    createIndex(indexName: string, keyPath: string | string[]) {
      indexSet.add(indexName);
      this.createdIndexes.push([indexName, keyPath]);
    },
    deleteIndex(indexName: string) {
      indexSet.delete(indexName);
      this.deletedIndexes.push(indexName);
    },
    indexNames: {
      contains(name: string) {
        return indexSet.has(name);
      },
    },
  };
}

function createFakeDb(
  stores: Record<string, ReturnType<typeof createObjectStore>>,
  operations?: string[],
) {
  return {
    deletedStores: [] as string[],
    objectStoreNames: {
      contains(name: string) {
        return name in stores;
      },
    },
    createObjectStore(name: string) {
      operations?.push(`createObjectStore:${name}`);
      const store = createObjectStore([], [], operations, name);
      stores[name] = store;
      return store;
    },
    deleteObjectStore(name: string) {
      operations?.push(`deleteObjectStore:${name}`);
      delete stores[name];
      this.deletedStores.push(name);
    },
  };
}

describe('applyDbMigrations', () => {
  it('migrates activeTimer into activeTimers before deleting the legacy store in v6', async () => {
    const operations: string[] = [];
    const stores: Record<string, ReturnType<typeof createObjectStore>> = {};
    const activeTimerStore = createObjectStore([
      { id: 'legacy', taskId: 'task-1', startUtc: '2026-04-14T08:00:00.000Z', source: 'manual', workers: 1 },
    ], [], operations, 'activeTimer');
    const timeEntriesStore = createObjectStore([], [], operations, 'timeEntries');
    const tasksStore = createObjectStore([], [], operations, 'tasks');
    const projectsStore = createObjectStore([], [], operations, 'projects');

    Object.assign(stores, {
      activeTimer: activeTimerStore,
      timeEntries: timeEntriesStore,
      tasks: tasksStore,
      projects: projectsStore,
    });

    const db = createFakeDb(stores, operations);
    const transaction = {
      objectStore(name: string) {
        return stores[name];
      },
    };

    await applyDbMigrations(
      db as never,
      5,
      6,
      transaction as never,
      {} as never,
    );

    const activeTimersStore = stores.activeTimers;
    expect(activeTimersStore.records).toEqual([
      { id: 'task-1', taskId: 'task-1', startUtc: '2026-04-14T08:00:00.000Z', source: 'manual', workers: 1 },
    ]);
    expect(db.deletedStores).toEqual(['activeTimer']);
    expect(operations).toContain('add:activeTimers');
    expect(operations.indexOf('add:activeTimers')).toBeLessThan(operations.indexOf('deleteObjectStore:activeTimer'));
  });

  it('renames persisted buildPhase fields to phase in v30 migration and rebuilds template phase index', async () => {
    const taskStore = createObjectStore([
      { id: 'task-1', buildPhase: 'assembly' },
    ], [], undefined, 'tasks');
    const templateStore = createObjectStore([
      { id: 'template-1', buildPhase: 'dismantle' },
    ], ['by-phase'], undefined, 'taskTemplates');
    const unplannedTaskStore = createObjectStore([
      { id: 'return-task-1', buildPhase: null },
    ], [], undefined, 'executionReturnUnplannedTasks');

    const stores = {
      tasks: taskStore,
      taskTemplates: templateStore,
      executionReturnUnplannedTasks: unplannedTaskStore,
    };

    const db = createFakeDb(stores);

    const transaction = {
      objectStore(name: keyof typeof stores) {
        return stores[name];
      },
    };

    await applyDbMigrations(
      db as never,
      29,
      30,
      transaction as never,
      {} as never,
    );

    expect(taskStore.records[0]).toEqual({ id: 'task-1', phase: 'assembly', additionalTagIds: [] });
    expect(templateStore.records[0]).toEqual({ id: 'template-1', phase: 'dismantle' });
    expect(unplannedTaskStore.records[0]).toEqual({ id: 'return-task-1', phase: null });

    expect(templateStore.deletedIndexes).toEqual(['by-phase']);
    expect(templateStore.createdIndexes).toEqual([['by-phase', 'phase']]);
  });

  it('migrates legacy crewByDate schedules to personHoursByDate in v32 without looping across DST dates', async () => {
    const plansStore = createObjectStore([
      {
        id: 'plan-1',
        workCalendar: [
          { date: '2026-03-29', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00' },
          { date: '2026-03-30', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00' },
        ],
        lineItems: [
          {
            id: 'line-1',
            workQuantity: 8,
            assemblyRate: 1,
            assemblyCrew: 1,
            assemblyTimeHours: 0,
            assemblyScheduledStart: '2026-03-29',
            assemblyScheduledEnd: '2026-03-30',
            assemblyCrewByDate: {
              '2026-03-29': 1,
              '2026-03-30': 1,
            },
          },
        ],
      },
    ], [], undefined, 'plans');

    const stores = {
      plans: plansStore,
    };

    const db = createFakeDb(stores);

    const transaction = {
      objectStore(name: keyof typeof stores) {
        return stores[name];
      },
    };

    await applyDbMigrations(
      db as never,
      31,
      32,
      transaction as never,
      {} as never,
    );

    const lineItem = (plansStore.records[0].lineItems as Array<Record<string, unknown>>)[0];
    expect(lineItem.assemblyPersonHoursByDate).toEqual({
      '2026-03-29': 4,
      '2026-03-30': 4,
    });
    expect(lineItem.assemblyScheduledStart).toBe('2026-03-29');
    expect(lineItem.assemblyScheduledEnd).toBe('2026-03-30');
    expect(lineItem.assemblyCrewByDate).toBeUndefined();
  });
});

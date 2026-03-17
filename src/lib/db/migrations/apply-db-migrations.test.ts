import { describe, expect, it } from 'vitest';
import { applyDbMigrations } from './apply-db-migrations';

type FakeRecord = Record<string, unknown>;

function createObjectStore(records: FakeRecord[], indexes: string[] = []) {
  const indexSet = new Set(indexes);

  return {
    records,
    putCalls: [] as FakeRecord[],
    deletedIndexes: [] as string[],
    createdIndexes: [] as Array<[string, string]>,
    getAll() {
      return Promise.resolve(records);
    },
    put(record: FakeRecord) {
      this.putCalls.push(record);
      return Promise.resolve(record);
    },
    createIndex(name: string, keyPath: string) {
      indexSet.add(name);
      this.createdIndexes.push([name, keyPath]);
    },
    deleteIndex(name: string) {
      indexSet.delete(name);
      this.deletedIndexes.push(name);
    },
    indexNames: {
      contains(name: string) {
        return indexSet.has(name);
      },
    },
  };
}

function flushMicrotasks() {
  return Promise.resolve();
}

describe('applyDbMigrations', () => {
  it('renames persisted buildPhase fields to phase in v30 migration and rebuilds template phase index', async () => {
    const taskStore = createObjectStore([
      { id: 'task-1', buildPhase: 'assembly' },
    ]);
    const templateStore = createObjectStore([
      { id: 'template-1', buildPhase: 'dismantle' },
    ], ['by-phase']);
    const unplannedTaskStore = createObjectStore([
      { id: 'return-task-1', buildPhase: null },
    ]);

    const stores = {
      tasks: taskStore,
      taskTemplates: templateStore,
      executionReturnUnplannedTasks: unplannedTaskStore,
    };

    const db = {
      objectStoreNames: {
        contains(name: string) {
          return name in stores;
        },
      },
    };

    const transaction = {
      objectStore(name: keyof typeof stores) {
        return stores[name];
      },
    };

    applyDbMigrations(
      db as never,
      29,
      30,
      transaction as never,
      {} as never,
    );

    await flushMicrotasks();
    await flushMicrotasks();

    expect(taskStore.records[0]).toEqual({ id: 'task-1', phase: 'assembly' });
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
    ]);

    const stores = {
      plans: plansStore,
    };

    const db = {
      objectStoreNames: {
        contains(name: string) {
          return name in stores;
        },
      },
    };

    const transaction = {
      objectStore(name: keyof typeof stores) {
        return stores[name];
      },
    };

    applyDbMigrations(
      db as never,
      31,
      32,
      transaction as never,
      {} as never,
    );

    await flushMicrotasks();
    await flushMicrotasks();

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

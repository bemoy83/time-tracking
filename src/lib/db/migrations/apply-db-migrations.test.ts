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
});

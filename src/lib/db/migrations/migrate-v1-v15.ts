import {
  PROJECT_COLORS,
  type ActiveTimer,
} from '../../types';
import type { MigrationContext } from './migration-helpers';
import { backfillStore } from './migration-helpers';

/** Legacy placeholder task ID - removed; migration cleans up any existing instances. */
const LEGACY_UNASSIGNED_TASK_ID = 'unassigned';

export async function migrateV1ToV15({
  db,
  oldVersion,
  transaction,
}: MigrationContext): Promise<void> {
  if (oldVersion < 1) {
    const timerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
    timerStore.createIndex('by-task', 'taskId', { unique: true });

    const entriesStore = db.createObjectStore('timeEntries', { keyPath: 'id' });
    entriesStore.createIndex('by-task', 'taskId');
    entriesStore.createIndex('by-sync-status', 'syncStatus');
    entriesStore.createIndex('by-startUtc', 'startUtc');

    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
    tasksStore.createIndex('by-project', 'projectId');
    tasksStore.createIndex('by-parent', 'parentId');
    tasksStore.createIndex('by-status', 'status');

    db.createObjectStore('projects', { keyPath: 'id' });
  }

  if (oldVersion < 2) {
    await backfillStore(transaction, 'projects', (project, index) => {
      const p = project as unknown as Record<string, unknown>;
      if (p.color) return false;
      p.color = PROJECT_COLORS[index % PROJECT_COLORS.length];
      return true;
    });
  }

  if (oldVersion < 3) {
    await transaction.objectStore('tasks').delete(LEGACY_UNASSIGNED_TASK_ID);
  }

  if (oldVersion < 5) {
    const notesStore = db.createObjectStore('taskNotes', { keyPath: 'id' });
    notesStore.createIndex('by-task', 'taskId');
  }

  if (oldVersion < 4 && oldVersion >= 1) {
    await backfillStore(transaction, 'timeEntries', (entry) => {
      const e = entry as unknown as Record<string, unknown>;
      if (e.workers !== undefined) return false;
      e.workers = 1;
      return true;
    });

    if (db.objectStoreNames.contains('activeTimer' as never)) {
      const timerStore = transaction.objectStore('activeTimer' as never);
      const timers = await timerStore.getAll();

      for (const timer of timers as Array<Record<string, unknown>>) {
        if (timer.workers === undefined) {
          timer.workers = 1;
          await timerStore.put(timer as never);
        }
      }
    }
  }

  if (oldVersion >= 1 && oldVersion < 6) {
    const newTimerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
    newTimerStore.createIndex('by-task', 'taskId', { unique: true });

    if (db.objectStoreNames.contains('activeTimer' as never)) {
      const oldStore = transaction.objectStore('activeTimer' as never);
      const timers = await oldStore.getAll();
      const allTimers = timers as ActiveTimer[];

      if (allTimers.length > 0) {
        const existing = allTimers[0];
        const migrated: ActiveTimer = {
          ...existing,
          id: existing.taskId,
        };
        await newTimerStore.add(migrated);
      }

      db.deleteObjectStore('activeTimer' as never);
    }

    const entriesStore = transaction.objectStore('timeEntries');
    if (!entriesStore.indexNames.contains('by-startUtc')) {
      entriesStore.createIndex('by-startUtc', 'startUtc');
    }
  }

  if (oldVersion < 7 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.estimatedMinutes !== undefined) return false;
      t.estimatedMinutes = null;
      return true;
    });
  }

  if (oldVersion < 8 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.workQuantity !== undefined) return false;
      t.workQuantity = null;
      t.workUnit = null;
      return true;
    });
  }

  if (oldVersion < 10) {
    if (!db.objectStoreNames.contains('taskTemplates')) {
      const templateStore = db.createObjectStore('taskTemplates', { keyPath: 'id' });
      templateStore.createIndex('by-phase', 'phase');
    }
  }

  if (oldVersion < 9 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.crew !== undefined) return false;
      t.crew = null;
      return true;
    });
  }

  if (oldVersion < 11 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.targetProductivity !== undefined) return false;
      t.targetProductivity = null;
      return true;
    });
  }

  if (oldVersion < 13) {
    if (!db.objectStoreNames.contains('attributionSnapshots')) {
      db.createObjectStore('attributionSnapshots', { keyPath: 'id' });
    }
  }

  if (oldVersion < 12 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.phase !== undefined) return false;
      t.phase = null;
      return true;
    });
  }

  if (oldVersion < 14 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.archivedAt !== undefined) return false;
      t.archivedAt = null;
      t.archiveVersion = null;
      return true;
    });
  }

  if (oldVersion < 15) {
    db.createObjectStore('plans', { keyPath: 'id' });
  }
}

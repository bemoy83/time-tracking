/**
 * IndexedDB setup using idb library.
 * Provides typed database access for offline-first persistence.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  ActiveTimer,
  TimeEntry,
  Task,
  Project,
  TaskNote,
  TemplateNote,
  TaskTemplate,
  AttributionSnapshot,
  WorkType,
} from './types';
import type { Plan } from './planning/plan-model';
import { PROJECT_COLORS } from './types';
import type {
  ImportedExecutionReturnLineItemRecord,
  ImportedExecutionReturnRecord,
  ImportedExecutionReturnUnplannedTaskRecord,
} from './interop/data-transfer/contracts';
import {
  generateDefaultWorkCalendar,
  reconcileWorkCalendar,
} from './planning/scheduling/work-calendar';

const DB_NAME = 'time-tracking-db';
const DB_VERSION = 25;

/** Legacy placeholder task ID – removed; migration cleans up any existing instances */
const LEGACY_UNASSIGNED_TASK_ID = 'unassigned';

/**
 * Database schema for idb type safety.
 */
interface TimeTrackingDBSchema extends DBSchema {
  // Active timers store (one record per task with active timer)
  activeTimers: {
    key: string;
    value: ActiveTimer;
    indexes: {
      'by-task': string;
    };
  };
  // Time entries with taskId index for querying by task
  timeEntries: {
    key: string;
    value: TimeEntry;
    indexes: {
      'by-task': string;
      'by-sync-status': string;
      'by-startUtc': string;
    };
  };
  // Tasks with projectId and parentId indexes
  tasks: {
    key: string;
    value: Task;
    indexes: {
      'by-project': string;
      'by-parent': string;
      'by-status': string;
    };
  };
  // Projects store
  projects: {
    key: string;
    value: Project;
  };
  // Task notes / activity log
  taskNotes: {
    key: string;
    value: TaskNote;
    indexes: {
      'by-task': string;
    };
  };
  // Template notes / activity log
  templateNotes: {
    key: string;
    value: TemplateNote;
    indexes: {
      'by-template': string;
    };
  };
  // Task templates for recurring tasks
  taskTemplates: {
    key: string;
    value: TaskTemplate;
    indexes: {
      'by-phase': string;
    };
  };
  // Attribution snapshots cache
  attributionSnapshots: {
    key: string;
    value: AttributionSnapshot;
  };
  // Planning workspace plans
  plans: {
    key: string;
    value: Plan;
  };
  // Work type definitions
  workTypes: {
    key: string;
    value: WorkType;
    indexes: {
      'by-title-unit-phase': [string, string, string];
    };
  };
  // Imported execution-return envelopes (planner-side)
  executionReturns: {
    key: string;
    value: ImportedExecutionReturnRecord;
    indexes: {
      'by-plan': string;
      'by-imported-at': string;
    };
  };
  // Imported execution-return line-item annotations
  executionReturnLineItems: {
    key: string;
    value: ImportedExecutionReturnLineItemRecord;
    indexes: {
      'by-plan': string;
      'by-return': string;
      'by-imported-at': string;
    };
  };
  // Imported execution-return unplanned task snapshots
  executionReturnUnplannedTasks: {
    key: string;
    value: ImportedExecutionReturnUnplannedTaskRecord;
    indexes: {
      'by-plan': string;
      'by-return': string;
      'by-imported-at': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<TimeTrackingDBSchema>> | null = null;

/**
 * Initialize and return the database instance.
 * Creates stores and indexes on first run.
 */
export function getDB(): Promise<IDBPDatabase<TimeTrackingDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TimeTrackingDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Version 1: Create all stores
        if (oldVersion < 1) {
          // Active timers store (multi-record, one per task)
          const timerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
          timerStore.createIndex('by-task', 'taskId', { unique: true });

          // Time entries store with indexes
          const entriesStore = db.createObjectStore('timeEntries', { keyPath: 'id' });
          entriesStore.createIndex('by-task', 'taskId');
          entriesStore.createIndex('by-sync-status', 'syncStatus');
          entriesStore.createIndex('by-startUtc', 'startUtc');

          // Tasks store with indexes
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('by-project', 'projectId');
          tasksStore.createIndex('by-parent', 'parentId');
          tasksStore.createIndex('by-status', 'status');

          // Projects store
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        type StoreKey = Extract<keyof TimeTrackingDBSchema, string>;
        const backfillStore = <StoreName extends StoreKey>(
          storeName: StoreName,
          mutate: (record: TimeTrackingDBSchema[StoreName]['value'], index: number) => boolean,
        ) => {
          const store = transaction.objectStore(storeName as never);
          store.getAll().then((records) => {
            records.forEach((record, index) => {
              if (mutate(record, index)) {
                store.put(record);
              }
            });
          });
        };

        // Version 2: Add color to existing projects
        if (oldVersion < 2) {
          backfillStore('projects', (project, index) => {
            const p = project as unknown as Record<string, unknown>;
            if (p.color) return false;
            p.color = PROJECT_COLORS[index % PROJECT_COLORS.length];
            return true;
          });
        }

        // Version 3: Remove legacy "Unassigned" placeholder task
        if (oldVersion < 3) {
          transaction.objectStore('tasks').delete(LEGACY_UNASSIGNED_TASK_ID);
        }

        // Version 5: Add taskNotes store
        if (oldVersion < 5) {
          const notesStore = db.createObjectStore('taskNotes', { keyPath: 'id' });
          notesStore.createIndex('by-task', 'taskId');
        }

        // Version 4: Add workers field to timeEntries and activeTimer
        if (oldVersion < 4 && oldVersion >= 1) {
          backfillStore('timeEntries', (entry) => {
            const e = entry as unknown as Record<string, unknown>;
            if (e.workers !== undefined) return false;
            e.workers = 1;
            return true;
          });
          // Only touch old activeTimer store if it exists (pre-v6)
          if (db.objectStoreNames.contains('activeTimer' as never)) {
            const timerStore = transaction.objectStore('activeTimer' as never);
            timerStore.getAll().then((timers: unknown[]) => {
              timers.forEach((timer) => {
                const t = timer as Record<string, unknown>;
                if (t.workers === undefined) {
                  t.workers = 1;
                  timerStore.put(timer);
                }
              });
            });
          }
        }

        // Version 6: Migrate singleton activeTimer → multi-record activeTimers store
        // Also add by-startUtc index on timeEntries
        if (oldVersion >= 1 && oldVersion < 6) {
          // Create new multi-record store
          const newTimerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
          newTimerStore.createIndex('by-task', 'taskId', { unique: true });

          // Migrate existing singleton timer if present
          if (db.objectStoreNames.contains('activeTimer' as never)) {
            const oldStore = transaction.objectStore('activeTimer' as never);
            oldStore.getAll().then((timers: unknown[]) => {
              const allTimers = timers as ActiveTimer[];
              if (allTimers.length > 0) {
                const existing = allTimers[0];
                const migrated: ActiveTimer = {
                  ...existing,
                  id: existing.taskId, // use taskId as id
                };
                newTimerStore.add(migrated);
              }
            });
            db.deleteObjectStore('activeTimer' as never);
          }

          // Add by-startUtc index to timeEntries
          const entriesStore = transaction.objectStore('timeEntries');
          if (!entriesStore.indexNames.contains('by-startUtc')) {
            entriesStore.createIndex('by-startUtc', 'startUtc');
          }
        }

        // Version 7: Add estimatedMinutes field to tasks
        if (oldVersion < 7 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.estimatedMinutes !== undefined) return false;
            t.estimatedMinutes = null;
            return true;
          });
        }

        // Version 8: Add workQuantity and workUnit fields to tasks
        if (oldVersion < 8 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.workQuantity !== undefined) return false;
            t.workQuantity = null;
            t.workUnit = null;
            return true;
          });
        }

        // Version 10: Add taskTemplates store
        if (oldVersion < 10) {
          if (!db.objectStoreNames.contains('taskTemplates')) {
            const templateStore = db.createObjectStore('taskTemplates', { keyPath: 'id' });
            templateStore.createIndex('by-phase', 'buildPhase');
          }
        }

        // Version 9: Add defaultWorkers field to tasks
        if (oldVersion < 9 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.defaultWorkers !== undefined) return false;
            t.defaultWorkers = null;
            return true;
          });
        }

        // Version 11: Add targetProductivity field to tasks
        if (oldVersion < 11 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.targetProductivity !== undefined) return false;
            t.targetProductivity = null;
            return true;
          });
        }

        // Version 13: Add attributionSnapshots store
        if (oldVersion < 13) {
          if (!db.objectStoreNames.contains('attributionSnapshots')) {
            db.createObjectStore('attributionSnapshots', { keyPath: 'id' });
          }
        }

        // Version 12: Add buildPhase field to tasks
        if (oldVersion < 12 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.buildPhase !== undefined) return false;
            t.buildPhase = null;
            return true;
          });
        }

        // Version 14: Add archivedAt and archiveVersion fields to tasks
        if (oldVersion < 14 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.archivedAt !== undefined) return false;
            t.archivedAt = null;
            t.archiveVersion = null;
            return true;
          });
        }

        // Version 15: Add plans store for planning workspace
        if (oldVersion < 15) {
          db.createObjectStore('plans', { keyPath: 'id' });
        }

        // Version 16: Add workTypes store and workTypeId field.
        if (oldVersion < 16) {
          const workTypeStore = db.createObjectStore('workTypes', { keyPath: 'id' });
          workTypeStore.createIndex('by-title-unit-phase', ['title', 'workUnit', 'buildPhase']);

          // Backfill workTypeId on existing templates
          if (db.objectStoreNames.contains('taskTemplates')) {
            backfillStore('taskTemplates', (template) => {
              const t = template as unknown as Record<string, unknown>;
              if (t.workTypeId !== undefined) return false;
              t.workTypeId = null;
              return true;
            });
          }

          // Backfill workTypeId on existing tasks
          if (oldVersion >= 1) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.workTypeId !== undefined) return false;
              t.workTypeId = null;
              return true;
            });
          }
        }

        // Version 17: Add templateNotes store
        if (oldVersion < 17) {
          if (!db.objectStoreNames.contains('templateNotes')) {
            const templateNotesStore = db.createObjectStore('templateNotes', { keyPath: 'id' });
            templateNotesStore.createIndex('by-template', 'templateId');
          }
        }

        // Version 19: Add scheduledStart and scheduledEnd to plan line items
        if (oldVersion < 19 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            let changed = false;
            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.scheduledStart === undefined) { i.scheduledStart = null; changed = true; }
              if (i.scheduledEnd === undefined) { i.scheduledEnd = null; changed = true; }
            }
            return changed;
          });
        }

        // Version 20: Add task lineage and KPI exclusion + plan reviewedAt
        if (oldVersion < 20) {
          if (oldVersion >= 1) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              let changed = false;
              if (t.sourcePlanId === undefined) {
                t.sourcePlanId = null;
                changed = true;
              }
              if (t.sourceLineItemId === undefined) {
                t.sourceLineItemId = null;
                changed = true;
              }
              if (t.excludeFromKpi === undefined) {
                t.excludeFromKpi = false;
                changed = true;
              }
              return changed;
            });
          }
          if (db.objectStoreNames.contains('plans')) {
            backfillStore('plans', (plan) => {
              const p = plan as unknown as Record<string, unknown>;
              if (p.reviewedAt !== undefined) return false;
              p.reviewedAt = null;
              return true;
            });
          }
        }

        // Version 21: Add reviewNote field to plan line items
        if (oldVersion < 21 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            let changed = false;
            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.reviewNote === undefined) {
                i.reviewNote = null;
                changed = true;
              }
            }
            return changed;
          });
        }

        // Version 18: Add projectId field to plans
        if (oldVersion < 18 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            if (p.projectId !== undefined) return false;
            p.projectId = null;
            return true;
          });
        }

        // Version 22: Migrate plan status 'locked' → 'active', lockedAt → activatedAt
        if (oldVersion < 22 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;
            if (p.status === 'locked') {
              p.status = 'active';
              changed = true;
            }
            if (p.lockedAt !== undefined) {
              p.activatedAt = p.lockedAt;
              delete p.lockedAt;
              changed = true;
            }
            if (p.activatedAt === undefined) {
              p.activatedAt = null;
              changed = true;
            }
            return changed;
          });
        }

        // Version 23: Backfill executor lifecycle fields and line-item execution annotations
        if (oldVersion < 23 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;

            if (p.importedAt === undefined) {
              p.importedAt = null;
              changed = true;
            }

            if (p.sessionClosedAt === undefined) {
              p.sessionClosedAt = null;
              changed = true;
            }

            if (p.reviewedAt != null && p.status !== 'reviewed' && p.status !== 'session-closed') {
              p.status = 'reviewed';
              changed = true;
            }

            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.executionStatus === undefined) {
                i.executionStatus = 'pending';
                changed = true;
              }
              if (i.blockReason === undefined) {
                i.blockReason = null;
                changed = true;
              }
              if (i.blockCategory === undefined) {
                i.blockCategory = null;
                changed = true;
              }
              if (i.executorNote === undefined) {
                i.executorNote = null;
                changed = true;
              }
              if (i.deferredNote === undefined) {
                i.deferredNote = null;
                changed = true;
              }
              if (i.removedFromSource === undefined) {
                i.removedFromSource = false;
                changed = true;
              }
            }

            return changed;
          });
        }

        // Version 24: Add execution return import stores for planner-side wrap-up v2
        if (oldVersion < 24) {
          if (!db.objectStoreNames.contains('executionReturns')) {
            const store = db.createObjectStore('executionReturns', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-imported-at', 'importedAt');
          }
          if (!db.objectStoreNames.contains('executionReturnLineItems')) {
            const store = db.createObjectStore('executionReturnLineItems', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-return', 'executionReturnId');
            store.createIndex('by-imported-at', 'importedAt');
          }
          if (!db.objectStoreNames.contains('executionReturnUnplannedTasks')) {
            const store = db.createObjectStore('executionReturnUnplannedTasks', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-return', 'executionReturnId');
            store.createIndex('by-imported-at', 'importedAt');
          }
        }

        // Version 25: Add scheduling/work-calendar and amendment metadata fields
        if (oldVersion < 25 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;

            if (p.eventStartDate === undefined) {
              p.eventStartDate = null;
              changed = true;
            }
            if (p.eventEndDate === undefined) {
              p.eventEndDate = null;
              changed = true;
            }
            if (p.defaultCrewSize === undefined) {
              p.defaultCrewSize = null;
              changed = true;
            }
            if (!Array.isArray(p.workCalendar)) {
              p.workCalendar = [];
              changed = true;
            }

            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.originalScheduledStart === undefined) {
                i.originalScheduledStart = null;
                changed = true;
              }
              if (i.originalScheduledEnd === undefined) {
                i.originalScheduledEnd = null;
                changed = true;
              }
              if (i.amendmentNote === undefined) {
                i.amendmentNote = null;
                changed = true;
              }
              if (i.amendedAt === undefined) {
                i.amendedAt = null;
                changed = true;
              }
            }

            return changed;
          });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Active Timer Operations (Multi-timer)
// ============================================================

/**
 * Get all active timers.
 */
export async function getAllActiveTimers(): Promise<ActiveTimer[]> {
  const db = await getDB();
  return db.getAll('activeTimers');
}

/**
 * Get the active timer for a specific task, if any.
 */
export async function getActiveTimerByTask(taskId: string): Promise<ActiveTimer | null> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  return timer ?? null;
}

/**
 * Add an active timer. Each task may have at most one.
 */
export async function addActiveTimer(timer: ActiveTimer): Promise<void> {
  const db = await getDB();
  await db.add('activeTimers', timer);
}

/**
 * Remove the active timer for a specific task.
 */
export async function removeActiveTimer(taskId: string): Promise<void> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  if (timer) {
    await db.delete('activeTimers', timer.id);
  }
}

/**
 * Update fields on an active timer for a specific task.
 */
export async function updateActiveTimer(taskId: string, updates: Partial<ActiveTimer>): Promise<void> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  if (timer) {
    await db.put('activeTimers', { ...timer, ...updates, id: timer.id, taskId: timer.taskId });
  }
}

// ============================================================
// Time Entry Operations
// ============================================================

/**
 * Add a completed time entry.
 */
export async function addTimeEntry(entry: TimeEntry): Promise<void> {
  const db = await getDB();
  await db.add('timeEntries', entry);
}

/**
 * Get all time entries for a specific task.
 */
export async function getTimeEntriesByTask(taskId: string): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('timeEntries', 'by-task', taskId);
}

/**
 * Get all time entries with a specific sync status.
 */
export async function getTimeEntriesBySyncStatus(status: string): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('timeEntries', 'by-sync-status', status);
}

/**
 * Get all pending (unsynced) time entries.
 */
export async function getPendingTimeEntries(): Promise<TimeEntry[]> {
  return getTimeEntriesBySyncStatus('pending');
}

/**
 * Update a time entry's sync status.
 */
export async function updateTimeEntrySyncStatus(
  id: string,
  syncStatus: TimeEntry['syncStatus']
): Promise<void> {
  const db = await getDB();
  const entry = await db.get('timeEntries', id);
  if (entry) {
    await db.put('timeEntries', { ...entry, syncStatus });
  }
}

/**
 * Get all time entries.
 */
export async function getAllTimeEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.getAll('timeEntries');
}

/**
 * Get a single time entry by ID.
 */
export async function getTimeEntry(id: string): Promise<TimeEntry | null> {
  const db = await getDB();
  const entry = await db.get('timeEntries', id);
  return entry ?? null;
}

/**
 * Update a time entry (full replace).
 */
export async function updateTimeEntry(entry: TimeEntry): Promise<void> {
  const db = await getDB();
  await db.put('timeEntries', entry);
}

/**
 * Delete a single time entry by ID.
 */
export async function deleteTimeEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('timeEntries', id);
}

/**
 * Delete all time entries for a specific task.
 * Uses a transaction for atomicity (all or nothing).
 */
export async function deleteTimeEntriesByTask(taskId: string): Promise<void> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('timeEntries', 'by-task', taskId);

  if (entries.length === 0) return;

  const tx = db.transaction('timeEntries', 'readwrite');
  await Promise.all([
    ...entries.map((entry) => tx.store.delete(entry.id)),
    tx.done,
  ]);
}

// ============================================================
// Task Operations
// ============================================================

/**
 * Add a new task.
 */
export async function addTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.add('tasks', task);
}

/**
 * Get a task by ID.
 */
export async function getTask(id: string): Promise<Task | null> {
  const db = await getDB();
  const task = await db.get('tasks', id);
  return task ?? null;
}

/**
 * Update a task.
 */
export async function updateTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

/**
 * Get all tasks.
 */
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

/**
 * Get tasks by project.
 */
export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const db = await getDB();
  return db.getAllFromIndex('tasks', 'by-project', projectId);
}

/**
 * Get subtasks of a parent task.
 */
export async function getSubtasks(parentId: string): Promise<Task[]> {
  const db = await getDB();
  return db.getAllFromIndex('tasks', 'by-parent', parentId);
}

/**
 * Delete a task by ID.
 * Note: Does not cascade to subtasks or time entries.
 * Cascade logic is handled in the store layer.
 */
export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

// ============================================================
// Project Operations
// ============================================================

/**
 * Add a new project.
 */
export async function addProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.add('projects', project);
}

/**
 * Get a project by ID.
 */
export async function getProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const project = await db.get('projects', id);
  return project ?? null;
}

/**
 * Get all projects.
 */
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

/**
 * Update a project.
 */
export async function updateProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

/**
 * Delete a project by ID.
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

// ============================================================
// Task Note Operations
// ============================================================

/**
 * Add a task note.
 */
export async function addTaskNote(note: TaskNote): Promise<void> {
  const db = await getDB();
  await db.add('taskNotes', note);
}

/**
 * Get all notes for a task, sorted newest-first.
 */
export async function getTaskNotesByTask(taskId: string): Promise<TaskNote[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('taskNotes', 'by-task', taskId);
  notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return notes;
}

/**
 * Delete a single task note.
 */
export async function deleteTaskNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('taskNotes', id);
}

/**
 * Delete all notes for a task (cascade delete).
 */
export async function deleteTaskNotesByTask(taskId: string): Promise<void> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('taskNotes', 'by-task', taskId);
  if (notes.length === 0) return;

  const tx = db.transaction('taskNotes', 'readwrite');
  await Promise.all([
    ...notes.map((note) => tx.store.delete(note.id)),
    tx.done,
  ]);
}

/**
 * Add a template note.
 */
export async function addTemplateNote(note: TemplateNote): Promise<void> {
  const db = await getDB();
  await db.add('templateNotes', note);
}

/**
 * Get all notes for a template, sorted newest-first.
 */
export async function getTemplateNotesByTemplate(templateId: string): Promise<TemplateNote[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('templateNotes', 'by-template', templateId);
  notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return notes;
}

/**
 * Delete all template notes.
 */
export async function deleteAllTemplateNotes(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('templateNotes', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// ============================================================
// Task Template Operations
// ============================================================

/**
 * Add a task template.
 */
export async function addTaskTemplate(template: TaskTemplate): Promise<void> {
  const db = await getDB();
  await db.add('taskTemplates', template);
}

/**
 * Get a task template by ID.
 */
export async function getTaskTemplate(id: string): Promise<TaskTemplate | null> {
  const db = await getDB();
  const template = await db.get('taskTemplates', id);
  return template ?? null;
}

/**
 * Get all task templates.
 */
export async function getAllTaskTemplates(): Promise<TaskTemplate[]> {
  const db = await getDB();
  return db.getAll('taskTemplates');
}

/**
 * Update a task template (full replace).
 */
export async function updateTaskTemplate(template: TaskTemplate): Promise<void> {
  const db = await getDB();
  await db.put('taskTemplates', template);
}

/**
 * Delete a task template by ID.
 */
export async function deleteTaskTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('taskTemplates', id);
}

/**
 * Delete all task templates.
 */
export async function deleteAllTaskTemplates(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('taskTemplates', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// ============================================================
// Bulk Delete Operations
// ============================================================

/**
 * Delete all time entries.
 */
export async function deleteAllTimeEntries(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('timeEntries', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

/**
 * Delete all tasks.
 */
export async function deleteAllTasks(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

/**
 * Delete all projects.
 */
export async function deleteAllProjects(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('projects', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// ============================================================
// Attribution Snapshot Operations
// ============================================================

/**
 * Get an attribution snapshot by policy (used as key).
 */
export async function getAttributionSnapshot(policy: string): Promise<AttributionSnapshot | null> {
  const db = await getDB();
  const snapshot = await db.get('attributionSnapshots', policy);
  return snapshot ?? null;
}

/**
 * Save an attribution snapshot (upsert by policy key).
 */
export async function setAttributionSnapshot(snapshot: AttributionSnapshot): Promise<void> {
  const db = await getDB();
  await db.put('attributionSnapshots', snapshot);
}

/**
 * Clear all attribution snapshots.
 * No-ops if the store does not exist (e.g. DB at older schema before migration).
 */
export async function clearAttributionSnapshots(): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('attributionSnapshots')) {
    return;
  }
  const tx = db.transaction('attributionSnapshots', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// ============================================================
// Plans (Planning Workspace)
// ============================================================

/**
 * Normalize a plan read from DB for forward-compatibility.
 * Legacy records may have status 'locked' / field 'lockedAt';
 * the canonical model now uses 'active' / 'activatedAt'.
 * This shim lets both old and new records coexist safely.
 */
export function normalizePlan(raw: Record<string, unknown>): Plan {
  // Map legacy 'locked' → 'active'
  if (raw.status === 'locked') {
    raw.status = 'active';
  }

  // Map legacy 'lockedAt' → 'activatedAt' if the new field is absent
  if (raw.lockedAt !== undefined && raw.activatedAt === undefined) {
    raw.activatedAt = raw.lockedAt;
  }

  if (raw.activatedAt === undefined) {
    raw.activatedAt = null;
  }

  if (raw.importedAt === undefined) {
    raw.importedAt = null;
  }

  if (raw.sessionClosedAt === undefined) {
    raw.sessionClosedAt = null;
  }

  if (raw.reviewedAt != null && raw.status !== 'reviewed' && raw.status !== 'session-closed') {
    raw.status = 'reviewed';
  }

  if (raw.eventStartDate === undefined) {
    raw.eventStartDate = null;
  }

  if (raw.eventEndDate === undefined) {
    raw.eventEndDate = null;
  }

  if (raw.defaultCrewSize === undefined) {
    raw.defaultCrewSize = null;
  }

  if (!Array.isArray(raw.workCalendar)) {
    raw.workCalendar = generateDefaultWorkCalendar(
      (raw.eventStartDate as string | null) ?? null,
      (raw.eventEndDate as string | null) ?? null,
      (raw.defaultCrewSize as number | null) ?? null,
    );
  } else {
    raw.workCalendar = reconcileWorkCalendar(
      raw.workCalendar as unknown as Array<{
        date: string;
        isWorkDay: boolean;
        accessStart: string | null;
        accessEnd: string | null;
        crewSize: number | null;
      }>,
      (raw.eventStartDate as string | null) ?? null,
      (raw.eventEndDate as string | null) ?? null,
      (raw.defaultCrewSize as number | null) ?? null,
    );
  }

  if (Array.isArray(raw.lineItems)) {
    for (const lineItem of raw.lineItems as Array<Record<string, unknown>>) {
      if (lineItem.executionStatus === undefined) lineItem.executionStatus = 'pending';
      if (lineItem.blockReason === undefined) lineItem.blockReason = null;
      if (lineItem.blockCategory === undefined) lineItem.blockCategory = null;
      if (lineItem.executorNote === undefined) lineItem.executorNote = null;
      if (lineItem.deferredNote === undefined) lineItem.deferredNote = null;
      if (lineItem.removedFromSource === undefined) lineItem.removedFromSource = false;
      if (lineItem.scheduledStart === undefined) lineItem.scheduledStart = null;
      if (lineItem.scheduledEnd === undefined) lineItem.scheduledEnd = null;
      if (lineItem.originalScheduledStart === undefined) lineItem.originalScheduledStart = null;
      if (lineItem.originalScheduledEnd === undefined) lineItem.originalScheduledEnd = null;
      if (lineItem.amendmentNote === undefined) lineItem.amendmentNote = null;
      if (lineItem.amendedAt === undefined) lineItem.amendedAt = null;
    }
  }

  return raw as unknown as Plan;
}

export async function addPlan(plan: Plan): Promise<void> {
  const db = await getDB();
  await db.add('plans', plan);
}

export async function getPlan(id: string): Promise<Plan | null> {
  const db = await getDB();
  const raw = await db.get('plans', id);
  if (!raw) return null;
  return normalizePlan(raw as unknown as Record<string, unknown>);
}

export async function getAllPlans(): Promise<Plan[]> {
  const db = await getDB();
  const raws = await db.getAll('plans');
  return raws.map((r) => normalizePlan(r as unknown as Record<string, unknown>));
}

export async function updatePlan(plan: Plan): Promise<void> {
  const db = await getDB();
  await db.put('plans', plan);
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('plans', id);
}

/**
 * Delete all plans (workspace and field plans).
 */
export async function deleteAllPlans(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('plans', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// ============================================================
// Imported Execution Return Operations
// ============================================================

export async function addExecutionReturnRecord(
  record: ImportedExecutionReturnRecord,
): Promise<void> {
  const db = await getDB();
  await db.add('executionReturns', record);
}

export async function addExecutionReturnLineItems(
  records: ImportedExecutionReturnLineItemRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('executionReturnLineItems', 'readwrite');
  await Promise.all([
    ...records.map((record) => tx.store.put(record)),
    tx.done,
  ]);
}

export async function addExecutionReturnUnplannedTasks(
  records: ImportedExecutionReturnUnplannedTaskRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('executionReturnUnplannedTasks', 'readwrite');
  await Promise.all([
    ...records.map((record) => tx.store.put(record)),
    tx.done,
  ]);
}

export async function getExecutionReturnsByPlanId(
  planId: string,
): Promise<ImportedExecutionReturnRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('executionReturns', 'by-plan', planId);
  return records.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getLatestExecutionReturnByPlanId(
  planId: string,
): Promise<ImportedExecutionReturnRecord | null> {
  const records = await getExecutionReturnsByPlanId(planId);
  return records[0] ?? null;
}

/** Returns plan IDs that have at least one imported execution return (for wrap-up eligibility). */
export async function getPlanIdsWithImportedExecutionReturns(): Promise<string[]> {
  const db = await getDB();
  const records = await db.getAll('executionReturns');
  return [...new Set(records.map((r) => r.planId))];
}

export async function getExecutionReturnLineItemsByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnLineItemRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnLineItems', 'by-return', executionReturnId);
}

export async function getExecutionReturnUnplannedTasksByReturnId(
  executionReturnId: string,
): Promise<ImportedExecutionReturnUnplannedTaskRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('executionReturnUnplannedTasks', 'by-return', executionReturnId);
}

export async function getLatestExecutionReturnBundleByPlanId(
  planId: string,
): Promise<{
  record: ImportedExecutionReturnRecord;
  lineItems: ImportedExecutionReturnLineItemRecord[];
  unplannedTasks: ImportedExecutionReturnUnplannedTaskRecord[];
} | null> {
  const record = await getLatestExecutionReturnByPlanId(planId);
  if (!record) return null;
  const [lineItems, unplannedTasks] = await Promise.all([
    getExecutionReturnLineItemsByReturnId(record.id),
    getExecutionReturnUnplannedTasksByReturnId(record.id),
  ]);
  return {
    record,
    lineItems,
    unplannedTasks,
  };
}

export async function deleteAllExecutionReturnImports(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['executionReturns', 'executionReturnLineItems', 'executionReturnUnplannedTasks'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('executionReturns').clear(),
    tx.objectStore('executionReturnLineItems').clear(),
    tx.objectStore('executionReturnUnplannedTasks').clear(),
    tx.done,
  ]);
}

// ============================================================
// Work Type Operations
// ============================================================

export async function addWorkType(workType: WorkType): Promise<void> {
  const db = await getDB();
  await db.add('workTypes', workType);
}

export async function getWorkType(id: string): Promise<WorkType | null> {
  const db = await getDB();
  const wt = await db.get('workTypes', id);
  return wt ?? null;
}

export async function getAllWorkTypes(): Promise<WorkType[]> {
  const db = await getDB();
  return db.getAll('workTypes');
}

export async function updateWorkType(workType: WorkType): Promise<void> {
  const db = await getDB();
  await db.put('workTypes', workType);
}

export async function deleteWorkType(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('workTypes', id);
}

/**
 * Delete all work types.
 */
export async function deleteAllWorkTypes(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('workTypes', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function findWorkTypeByKey(
  title: string,
  workUnit: string,
  buildPhase: string,
): Promise<WorkType | null> {
  const db = await getDB();
  const result = await db.getFromIndex('workTypes', 'by-title-unit-phase', [title, workUnit, buildPhase]);
  return result ?? null;
}

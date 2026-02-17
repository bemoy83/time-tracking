/**
 * IndexedDB setup using idb library.
 * Provides typed database access for offline-first persistence.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { ActiveTimer, TimeEntry, Task, Project, TaskNote } from './types';
import { PROJECT_COLORS } from './types';

const DB_NAME = 'time-tracking-db';
const DB_VERSION = 9;

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

        // Version 2: Add color to existing projects
        if (oldVersion < 2) {
          const projectStore = transaction.objectStore('projects');
          projectStore.getAll().then((projects) => {
            projects.forEach((project, index) => {
              const p = project as unknown as Record<string, unknown>;
              if (!p.color) {
                p.color = PROJECT_COLORS[index % PROJECT_COLORS.length];
                projectStore.put(project);
              }
            });
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
          const entryStore = transaction.objectStore('timeEntries');
          entryStore.getAll().then((entries) => {
            entries.forEach((entry) => {
              const e = entry as unknown as Record<string, unknown>;
              if (e.workers === undefined) {
                e.workers = 1;
                entryStore.put(entry);
              }
            });
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
          const taskStore = transaction.objectStore('tasks');
          taskStore.getAll().then((tasks) => {
            tasks.forEach((task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.estimatedMinutes === undefined) {
                t.estimatedMinutes = null;
                taskStore.put(task);
              }
            });
          });
        }

        // Version 8: Add workQuantity and workUnit fields to tasks
        if (oldVersion < 8 && oldVersion >= 1) {
          const taskStore = transaction.objectStore('tasks');
          taskStore.getAll().then((tasks) => {
            tasks.forEach((task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.workQuantity === undefined) {
                t.workQuantity = null;
                t.workUnit = null;
                taskStore.put(task);
              }
            });
          });
        }

        // Version 9: Add defaultWorkers field to tasks
        if (oldVersion < 9 && oldVersion >= 1) {
          const taskStore = transaction.objectStore('tasks');
          taskStore.getAll().then((tasks) => {
            tasks.forEach((task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.defaultWorkers === undefined) {
                t.defaultWorkers = null;
                taskStore.put(task);
              }
            });
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

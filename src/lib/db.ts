/**
 * IndexedDB setup using idb library.
 * Provides typed database access for offline-first persistence.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { ActiveTimer, TimeEntry, Task, Project } from './types';
import { PROJECT_COLORS } from './types';

const DB_NAME = 'time-tracking-db';
const DB_VERSION = 2;

/**
 * Database schema for idb type safety.
 */
interface TimeTrackingDBSchema extends DBSchema {
  // Singleton store for active timer (max one record with key 'current')
  activeTimer: {
    key: string;
    value: ActiveTimer;
  };
  // Time entries with taskId index for querying by task
  timeEntries: {
    key: string;
    value: TimeEntry;
    indexes: {
      'by-task': string;
      'by-sync-status': string;
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
          // Active timer store (singleton pattern - key is always 'current')
          db.createObjectStore('activeTimer', { keyPath: 'id' });

          // Time entries store with indexes
          const entriesStore = db.createObjectStore('timeEntries', { keyPath: 'id' });
          entriesStore.createIndex('by-task', 'taskId');
          entriesStore.createIndex('by-sync-status', 'syncStatus');

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
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Active Timer Operations (Singleton pattern)
// ============================================================

const ACTIVE_TIMER_KEY = 'current';

/**
 * Get the currently active timer, if any.
 */
export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const db = await getDB();
  const timer = await db.get('activeTimer', ACTIVE_TIMER_KEY);
  return timer ?? null;
}

/**
 * Set the active timer. Replaces any existing timer.
 * Enforces one-active-timer rule at the database level.
 */
export async function setActiveTimer(timer: ActiveTimer): Promise<void> {
  const db = await getDB();
  // Always use the same key to enforce singleton
  await db.put('activeTimer', { ...timer, id: ACTIVE_TIMER_KEY });
}

/**
 * Clear the active timer.
 */
export async function clearActiveTimer(): Promise<void> {
  const db = await getDB();
  await db.delete('activeTimer', ACTIVE_TIMER_KEY);
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

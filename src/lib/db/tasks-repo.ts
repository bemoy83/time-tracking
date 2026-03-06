import type { Task } from '../types';
import { getDB } from './core';

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

/**
 * Delete all tasks.
 */
export async function deleteAllTasks(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

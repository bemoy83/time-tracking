import type { TaskTemplate } from '../types';
import { getDB } from './core';

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

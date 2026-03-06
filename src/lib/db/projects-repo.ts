import type { Project } from '../types';
import { getDB } from './core';

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

/**
 * Delete all projects.
 */
export async function deleteAllProjects(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('projects', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

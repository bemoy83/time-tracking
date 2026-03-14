import type { Project } from '../types';
import { getDB } from './core';

function normalizeProject(raw: Record<string, unknown>): Project {
  if (raw.assemblyStartDate === undefined) raw.assemblyStartDate = null;
  if (raw.assemblyEndDate === undefined) raw.assemblyEndDate = null;
  if (raw.dismantleStartDate === undefined) raw.dismantleStartDate = null;
  if (raw.dismantleEndDate === undefined) raw.dismantleEndDate = null;
  if (raw.eventStartDate === undefined) raw.eventStartDate = null;
  if (raw.eventEndDate === undefined) raw.eventEndDate = null;
  return raw as unknown as Project;
}

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
  return project ? normalizeProject(project as unknown as Record<string, unknown>) : null;
}

/**
 * Get all projects.
 */
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  return projects.map((project) => normalizeProject(project as unknown as Record<string, unknown>));
}

/**
 * Update a project.
 */
export async function updateProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function findProjectByName(name: string): Promise<Project | null> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  const target = name.trim().toLowerCase().replace(/\s+/g, ' ');
  const match = projects.find((project) => {
    const projectName = String((project as unknown as Record<string, unknown>).name ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return projectName === target;
  });
  return match ? normalizeProject(match as unknown as Record<string, unknown>) : null;
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

import type { TaskNote, TemplateNote } from '../types';
import { getDB } from './core';

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

export async function getAllTaskNotes(): Promise<TaskNote[]> {
  const db = await getDB();
  return db.getAll('taskNotes');
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

export async function deleteAllTaskNotes(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('taskNotes', 'readwrite');
  await tx.store.clear();
  await tx.done;
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

export async function getAllTemplateNotes(): Promise<TemplateNote[]> {
  const db = await getDB();
  return db.getAll('templateNotes');
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

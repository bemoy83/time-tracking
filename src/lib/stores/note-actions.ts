/**
 * Task note CRUD actions.
 * Append-only activity log for tasks.
 */

import { addTaskNote, getTaskNotesByTask } from '../db';
import { TaskNote, generateId, nowUtc } from '../types';

/** Listeners notified when notes change. */
const listeners = new Set<() => void>();

export function subscribeNotes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

/**
 * Add a note to a task.
 */
export async function addNote(taskId: string, text: string): Promise<TaskNote> {
  const note: TaskNote = {
    id: generateId(),
    taskId,
    text: text.slice(0, 280),
    createdAt: nowUtc(),
  };

  await addTaskNote(note);
  notifyListeners();
  return note;
}

/**
 * Get all notes for a task (newest first).
 */
export async function getNotesByTask(taskId: string): Promise<TaskNote[]> {
  return getTaskNotesByTask(taskId);
}

/**
 * Reassignment — moves a time entry from one task to another,
 * writing audit notes to both tasks for traceability.
 */

import { getTimeEntry, updateTimeEntry, getTask } from './db';
import { addTaskNote } from './db';
import { generateId, nowUtc, createAuditNote } from './types';
import type { TaskNote } from './types';

/**
 * Reassign a time entry to a different task.
 * Writes audit notes on both the source and destination tasks.
 */
export async function reassignTimeEntry(
  entryId: string,
  newTaskId: string,
  reason: string,
): Promise<void> {
  const entry = await getTimeEntry(entryId);
  if (!entry) throw new Error(`Time entry ${entryId} not found`);

  const oldTaskId = entry.taskId;
  if (oldTaskId === newTaskId) return;

  const oldTask = await getTask(oldTaskId);
  const newTask = await getTask(newTaskId);

  const oldTitle = oldTask?.title ?? oldTaskId;
  const newTitle = newTask?.title ?? newTaskId;

  // Update the entry's taskId
  const updated = { ...entry, taskId: newTaskId, updatedAt: nowUtc() };
  await updateTimeEntry(updated);

  // Write audit note on old task
  const oldNote: TaskNote = {
    id: generateId(),
    taskId: oldTaskId,
    text: createAuditNote('Entry reassigned away', `Moved to "${newTitle}". Reason: ${reason}`),
    createdAt: nowUtc(),
  };
  await addTaskNote(oldNote);

  // Write audit note on new task
  const newNote: TaskNote = {
    id: generateId(),
    taskId: newTaskId,
    text: createAuditNote('Entry reassigned here', `Moved from "${oldTitle}". Reason: ${reason}`),
    createdAt: nowUtc(),
  };
  await addTaskNote(newNote);
}

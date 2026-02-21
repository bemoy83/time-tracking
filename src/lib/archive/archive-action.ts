/**
 * Archive action — marks a completed task as archive-grade after
 * passing integrity checks. Sets archivedAt timestamp and engine version.
 */

import { getTask, updateTask, getTimeEntriesByTask, getAllTasks, addTaskNote } from '../db';
import { generateId, nowUtc, createAuditNote } from '../types';
import type { Task, TaskNote } from '../types';
import { ENGINE_VERSION } from '../attribution/engine';
import { isArchiveReady } from './integrity';
import type { IntegrityIssue } from './integrity';

export interface ArchiveResult {
  success: boolean;
  taskId: string;
  issues: IntegrityIssue[];
}

/**
 * Archive a single completed task.
 * Gates on integrity checks — errors prevent archival, warnings are allowed.
 */
export async function archiveTask(taskId: string): Promise<ArchiveResult> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.status !== 'completed') throw new Error(`Task ${taskId} is not completed`);
  if (task.archivedAt != null) return { success: true, taskId, issues: [] }; // already archived

  const [allTasks, entries] = await Promise.all([
    getAllTasks(),
    getTimeEntriesByTask(taskId),
  ]);

  const { ready, issues } = isArchiveReady(task, allTasks, entries);

  if (!ready) {
    return { success: false, taskId, issues };
  }

  const now = nowUtc();
  const updated: Task = {
    ...task,
    archivedAt: now,
    archiveVersion: ENGINE_VERSION,
    updatedAt: now,
  };
  await updateTask(updated);

  const note: TaskNote = {
    id: generateId(),
    taskId,
    text: createAuditNote(
      'Task archived',
      `Archived with engine ${ENGINE_VERSION}. ${issues.length} warnings.`,
    ),
    createdAt: now,
  };
  await addTaskNote(note);

  return { success: true, taskId, issues };
}

/**
 * Archive all completed tasks that pass integrity checks.
 * Returns results for each task attempted.
 */
export async function archiveAllCompleted(): Promise<ArchiveResult[]> {
  const allTasks = await getAllTasks();
  const completed = allTasks.filter(
    (t) => t.status === 'completed' && t.archivedAt == null,
  );

  const results: ArchiveResult[] = [];
  for (const task of completed) {
    const result = await archiveTask(task.id);
    results.push(result);
  }

  return results;
}

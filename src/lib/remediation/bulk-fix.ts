/**
 * Bulk fix actions — applies remediation in batch with audit trail.
 *
 * Supported actions:
 * 1. Bulk reassign entries to their suggested owner
 * 2. Bulk set work context on tasks missing it
 */

import { getTimeEntry, updateTimeEntry, getTask, updateTask, addTaskNote } from '../db';
import { generateId, nowUtc, createAuditNote } from '../types';
import type { Task, TaskNote, WorkCategory, WorkUnit, BuildPhase } from '../types';
import type { IssueQueueItem } from './issue-queue';

export interface BulkFixResult {
  attempted: number;
  succeeded: number;
  failed: Array<{ itemId: string; error: string }>;
}

/**
 * Bulk reassign entries to their suggested target task.
 * Only processes items that have a suggestedTargetId.
 * Writes audit notes on both source and destination tasks.
 */
export async function bulkReassignToSuggested(
  items: IssueQueueItem[],
  reason: string,
): Promise<BulkFixResult> {
  const eligible = items.filter((i) => i.entryId != null && i.suggestedTargetId != null);
  const result: BulkFixResult = { attempted: eligible.length, succeeded: 0, failed: [] };

  for (const item of eligible) {
    try {
      const entry = await getTimeEntry(item.entryId!);
      if (!entry) {
        result.failed.push({ itemId: item.entryId!, error: 'Entry not found' });
        continue;
      }

      const oldTaskId = entry.taskId;
      const newTaskId = item.suggestedTargetId!;
      if (oldTaskId === newTaskId) {
        result.succeeded++;
        continue;
      }

      const now = nowUtc();

      // Update entry
      await updateTimeEntry({ ...entry, taskId: newTaskId, updatedAt: now });

      // Audit notes
      const oldTask = await getTask(oldTaskId);
      const newTask = await getTask(newTaskId);
      const oldTitle = oldTask?.title ?? oldTaskId;
      const newTitle = newTask?.title ?? newTaskId;

      const oldNote: TaskNote = {
        id: generateId(),
        taskId: oldTaskId,
        text: createAuditNote('Bulk reassign away', `Moved to "${newTitle}". Reason: ${reason}`),
        createdAt: now,
      };
      await addTaskNote(oldNote);

      const newNote: TaskNote = {
        id: generateId(),
        taskId: newTaskId,
        text: createAuditNote('Bulk reassign here', `Moved from "${oldTitle}". Reason: ${reason}`),
        createdAt: now,
      };
      await addTaskNote(newNote);

      result.succeeded++;
    } catch (err) {
      result.failed.push({
        itemId: item.entryId!,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

export interface WorkContextPatch {
  workCategory: WorkCategory;
  workUnit: WorkUnit;
  workQuantity: number;
  buildPhase: BuildPhase | null;
}

/**
 * Bulk set work context on tasks that are missing it.
 * Writes audit note on each updated task.
 */
export async function bulkSetWorkContext(
  taskIds: string[],
  patch: WorkContextPatch,
): Promise<BulkFixResult> {
  const result: BulkFixResult = { attempted: taskIds.length, succeeded: 0, failed: [] };

  for (const taskId of taskIds) {
    try {
      const task = await getTask(taskId);
      if (!task) {
        result.failed.push({ itemId: taskId, error: 'Task not found' });
        continue;
      }

      const now = nowUtc();
      const updated: Task = {
        ...task,
        workCategory: patch.workCategory,
        workUnit: patch.workUnit,
        workQuantity: patch.workQuantity,
        buildPhase: patch.buildPhase,
        updatedAt: now,
      };
      await updateTask(updated);

      const note: TaskNote = {
        id: generateId(),
        taskId,
        text: createAuditNote(
          'Bulk work context set',
          `Set ${patch.workCategory} / ${patch.workUnit} / ${patch.workQuantity}`,
        ),
        createdAt: now,
      };
      await addTaskNote(note);

      result.succeeded++;
    } catch (err) {
      result.failed.push({
        itemId: taskId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

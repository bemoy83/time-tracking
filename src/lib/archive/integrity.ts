/**
 * Archival integrity checker — validates tasks and their entries
 * before marking as archive-grade. Pure functions, deterministic.
 *
 * Checks:
 * 1. Missing work data (category, unit, quantity) on completed tasks
 * 2. Broken parent links (parentId references non-existent task)
 * 3. Duplicate entries (same taskId + startUtc + endUtc)
 * 4. Zero or negative duration entries
 * 5. Orphaned entries (taskId references non-existent task)
 */

import type { Task, TimeEntry } from '../types';
import { durationMs } from '../types';

export type IssueSeverity = 'error' | 'warning';

export type IssueType =
  | 'missing_work_data'
  | 'broken_parent_link'
  | 'duplicate_entry'
  | 'zero_duration_entry'
  | 'orphaned_entry';

export interface IntegrityIssue {
  type: IssueType;
  severity: IssueSeverity;
  taskId: string | null;
  entryId: string | null;
  message: string;
}

/**
 * Run all integrity checks on a set of tasks and their entries.
 * Returns a list of issues found. Empty list = all checks passed.
 */
export function checkIntegrity(
  tasks: Task[],
  entries: TimeEntry[],
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const taskIds = new Set(tasks.map((t) => t.id));

  // 1. Missing work data on completed tasks
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    const missing: string[] = [];
    if (task.workCategory == null) missing.push('workCategory');
    if (task.workUnit == null) missing.push('workUnit');
    if (task.workQuantity == null || task.workQuantity <= 0) missing.push('workQuantity');

    if (missing.length > 0) {
      issues.push({
        type: 'missing_work_data',
        severity: 'warning',
        taskId: task.id,
        entryId: null,
        message: `Missing: ${missing.join(', ')}`,
      });
    }
  }

  // 2. Broken parent links
  for (const task of tasks) {
    if (task.parentId != null && !taskIds.has(task.parentId)) {
      issues.push({
        type: 'broken_parent_link',
        severity: 'error',
        taskId: task.id,
        entryId: null,
        message: `Parent task "${task.parentId}" not found`,
      });
    }
  }

  // 3. Duplicate entries (same taskId + startUtc + endUtc)
  const entryKeys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.taskId}:${entry.startUtc}:${entry.endUtc}`;
    if (entryKeys.has(key)) {
      issues.push({
        type: 'duplicate_entry',
        severity: 'error',
        taskId: entry.taskId,
        entryId: entry.id,
        message: `Duplicate entry: same task, start, and end time`,
      });
    }
    entryKeys.add(key);
  }

  // 4. Zero or negative duration entries
  for (const entry of entries) {
    const ms = durationMs(entry.startUtc, entry.endUtc);
    if (ms <= 0) {
      issues.push({
        type: 'zero_duration_entry',
        severity: 'error',
        taskId: entry.taskId,
        entryId: entry.id,
        message: `Entry has ${ms === 0 ? 'zero' : 'negative'} duration`,
      });
    }
  }

  // 5. Orphaned entries (taskId not in task set)
  for (const entry of entries) {
    if (!taskIds.has(entry.taskId)) {
      issues.push({
        type: 'orphaned_entry',
        severity: 'error',
        taskId: entry.taskId,
        entryId: entry.id,
        message: `Entry references non-existent task "${entry.taskId}"`,
      });
    }
  }

  return issues;
}

/** Check if a task passes all integrity checks for archival. */
export function isArchiveReady(
  task: Task,
  allTasks: Task[],
  entries: TimeEntry[],
): { ready: boolean; issues: IntegrityIssue[] } {
  const taskEntries = entries.filter((e) => e.taskId === task.id);
  const issues = checkIntegrity([task, ...allTasks.filter((t) => t.id === task.parentId)], taskEntries);
  const taskIssues = issues.filter((i) => i.taskId === task.id || i.entryId != null);
  const hasErrors = taskIssues.some((i) => i.severity === 'error');

  return { ready: !hasErrors, issues: taskIssues };
}

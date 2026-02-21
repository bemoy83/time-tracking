/**
 * Issue queue — categorizes data quality issues from attribution results
 * into actionable remediation queues.
 *
 * Three queue categories:
 * 1. "Needs measurable owner" — unattributed entries (no measurable task in hierarchy)
 * 2. "Ambiguous owner" — entries with heuristic suggestions not yet applied
 * 3. "No work context" — completed tasks missing workCategory/workUnit/workQuantity
 */

import type { Task, AttributedEntry } from '../types';
import { isMeasurable } from '../attribution/engine';

export type IssueCategory =
  | 'needs_measurable_owner'
  | 'ambiguous_owner'
  | 'no_work_context';

export interface IssueQueueItem {
  category: IssueCategory;
  taskId: string;
  entryId: string | null;
  taskTitle: string;
  /** Human-readable description of the issue. */
  description: string;
  /** Suggested fix target (taskId to reassign to, or null). */
  suggestedTargetId: string | null;
  suggestedTargetTitle: string | null;
  /** Person-hours affected by this issue (0 for task-level issues). */
  personHours: number;
}

export interface IssueQueueResult {
  needsMeasurableOwner: IssueQueueItem[];
  ambiguousOwner: IssueQueueItem[];
  noWorkContext: IssueQueueItem[];
  totalIssues: number;
  totalAffectedHours: number;
}

/**
 * Build categorized issue queues from attribution results and tasks.
 * Pure function — no side effects.
 *
 * @param attributedEntries Full attribution results from the engine
 * @param tasks All tasks (for title lookup and work context checks)
 */
export function buildIssueQueues(
  attributedEntries: AttributedEntry[],
  tasks: Task[],
): IssueQueueResult {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const needsMeasurableOwner: IssueQueueItem[] = [];
  const ambiguousOwner: IssueQueueItem[] = [];
  const noWorkContext: IssueQueueItem[] = [];

  // 1 & 2: Scan attributed entries for unattributed / ambiguous
  for (const entry of attributedEntries) {
    const task = taskMap.get(entry.taskId);
    const taskTitle = task?.title ?? entry.taskId;

    if (entry.status === 'unattributed') {
      if (entry.suggestedOwnerTaskId) {
        // Has suggestion but not applied → ambiguous owner
        const suggestedTask = taskMap.get(entry.suggestedOwnerTaskId);
        ambiguousOwner.push({
          category: 'ambiguous_owner',
          taskId: entry.taskId,
          entryId: entry.entryId,
          taskTitle,
          description: `Entry has a suggested owner but was not auto-applied`,
          suggestedTargetId: entry.suggestedOwnerTaskId,
          suggestedTargetTitle: suggestedTask?.title ?? entry.suggestedOwnerTaskId,
          personHours: entry.personHours,
        });
      } else {
        // No suggestion at all → needs measurable owner
        needsMeasurableOwner.push({
          category: 'needs_measurable_owner',
          taskId: entry.taskId,
          entryId: entry.entryId,
          taskTitle,
          description: `No measurable task found in hierarchy`,
          suggestedTargetId: null,
          suggestedTargetTitle: null,
          personHours: entry.personHours,
        });
      }
    } else if (entry.status === 'ambiguous') {
      const suggestedTask = entry.suggestedOwnerTaskId
        ? taskMap.get(entry.suggestedOwnerTaskId)
        : null;
      ambiguousOwner.push({
        category: 'ambiguous_owner',
        taskId: entry.taskId,
        entryId: entry.entryId,
        taskTitle,
        description: `Multiple valid measurable owners`,
        suggestedTargetId: entry.suggestedOwnerTaskId,
        suggestedTargetTitle: suggestedTask?.title ?? null,
        personHours: entry.personHours,
      });
    }
  }

  // 3: Scan completed tasks for missing work context
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    if (task.parentId != null) continue; // subtasks inherit from parent
    if (isMeasurable(task)) continue;

    const missing: string[] = [];
    if (task.workCategory == null) missing.push('work category');
    if (task.workUnit == null) missing.push('work unit');
    if (task.workQuantity == null || task.workQuantity <= 0) missing.push('work quantity');

    noWorkContext.push({
      category: 'no_work_context',
      taskId: task.id,
      entryId: null,
      taskTitle: task.title,
      description: `Missing: ${missing.join(', ')}`,
      suggestedTargetId: null,
      suggestedTargetTitle: null,
      personHours: 0,
    });
  }

  const totalAffectedHours = [
    ...needsMeasurableOwner,
    ...ambiguousOwner,
    ...noWorkContext,
  ].reduce((sum, item) => sum + item.personHours, 0);

  return {
    needsMeasurableOwner,
    ambiguousOwner,
    noWorkContext,
    totalIssues: needsMeasurableOwner.length + ambiguousOwner.length + noWorkContext.length,
    totalAffectedHours,
  };
}

/**
 * Find the nearest measurable task for a given task.
 * Searches: parent → sibling tasks in same project → any measurable task with matching work type.
 */
export function findNearestMeasurable(
  taskId: string,
  tasks: Task[],
): { targetId: string; targetTitle: string; matchType: 'parent' | 'project_peer' | 'work_type_match' } | null {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  // 1. Check parent
  if (task.parentId) {
    const parent = tasks.find((t) => t.id === task.parentId);
    if (parent && isMeasurable(parent)) {
      return { targetId: parent.id, targetTitle: parent.title, matchType: 'parent' };
    }
  }

  // 2. Check project peers (same project, measurable, not self)
  if (task.projectId) {
    const peer = tasks.find(
      (t) =>
        t.id !== taskId &&
        t.projectId === task.projectId &&
        t.parentId == null &&
        isMeasurable(t),
    );
    if (peer) {
      return { targetId: peer.id, targetTitle: peer.title, matchType: 'project_peer' };
    }
  }

  // 3. Check any measurable task with matching work category
  if (task.workCategory) {
    const match = tasks.find(
      (t) =>
        t.id !== taskId &&
        t.parentId == null &&
        isMeasurable(t) &&
        t.workCategory === task.workCategory,
    );
    if (match) {
      return { targetId: match.id, targetTitle: match.title, matchType: 'work_type_match' };
    }
  }

  return null;
}

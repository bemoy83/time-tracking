/**
 * Archive maintenance scan — identifies integrity issues in archived
 * records and suggests repairs. Also finds archival candidates.
 */

import { getAllTasks, getTimeEntriesByTask } from '../db';
import type { Task, TimeEntry } from '../types';
import { checkIntegrity } from './integrity';
import type { IntegrityIssue } from './integrity';

export type RepairAction =
  | 'add_work_data'
  | 'fix_parent_link'
  | 'remove_duplicate'
  | 'remove_zero_entry'
  | 'remove_orphan';

export interface RepairSuggestion {
  taskId: string;
  action: RepairAction;
  description: string;
  issue: IntegrityIssue;
}

export interface MaintenanceReport {
  /** Archived tasks with integrity issues. */
  archivedIssues: RepairSuggestion[];
  /** Completed tasks eligible for archival. */
  archiveCandidates: string[];
  /** Completed tasks blocked from archival by errors. */
  blockedFromArchival: Array<{ taskId: string; issues: IntegrityIssue[] }>;
  /** Total archived tasks scanned. */
  archivedCount: number;
  /** Total completed-not-archived tasks scanned. */
  pendingCount: number;
}

const ISSUE_TO_ACTION: Record<IntegrityIssue['type'], RepairAction> = {
  missing_work_data: 'add_work_data',
  broken_parent_link: 'fix_parent_link',
  duplicate_entry: 'remove_duplicate',
  zero_duration_entry: 'remove_zero_entry',
  orphaned_entry: 'remove_orphan',
};

const ACTION_DESCRIPTIONS: Record<RepairAction, string> = {
  add_work_data: 'Add missing work category, unit, or quantity',
  fix_parent_link: 'Fix or clear broken parent task reference',
  remove_duplicate: 'Remove duplicate time entry',
  remove_zero_entry: 'Remove zero-duration time entry',
  remove_orphan: 'Remove orphaned time entry referencing missing task',
};

function toRepairSuggestion(issue: IntegrityIssue): RepairSuggestion {
  return {
    taskId: issue.taskId ?? 'unknown',
    action: ISSUE_TO_ACTION[issue.type],
    description: ACTION_DESCRIPTIONS[ISSUE_TO_ACTION[issue.type]],
    issue,
  };
}

/**
 * Run a full maintenance scan across all tasks.
 * Pure logic extracted for testability — accepts pre-loaded data.
 */
export function runMaintenanceScan(
  tasks: Task[],
  entriesByTask: Map<string, TimeEntry[]>,
): MaintenanceReport {
  const archived = tasks.filter((t) => t.archivedAt != null);
  const pendingArchival = tasks.filter(
    (t) => t.status === 'completed' && t.archivedAt == null,
  );

  // Scan archived tasks for issues
  const allEntries = Array.from(entriesByTask.values()).flat();
  const archivedEntries = allEntries.filter((e) =>
    archived.some((t) => t.id === e.taskId),
  );
  const archivedIssues = checkIntegrity(archived, archivedEntries).map(toRepairSuggestion);

  // Check pending tasks for archival readiness
  const archiveCandidates: string[] = [];
  const blockedFromArchival: Array<{ taskId: string; issues: IntegrityIssue[] }> = [];

  for (const task of pendingArchival) {
    const taskEntries = entriesByTask.get(task.id) ?? [];
    const issues = checkIntegrity(
      [task, ...tasks.filter((t) => t.id === task.parentId)],
      taskEntries,
    );
    const taskIssues = issues.filter(
      (i) => i.taskId === task.id || i.entryId != null,
    );
    const hasErrors = taskIssues.some((i) => i.severity === 'error');

    if (hasErrors) {
      blockedFromArchival.push({ taskId: task.id, issues: taskIssues });
    } else {
      archiveCandidates.push(task.id);
    }
  }

  return {
    archivedIssues,
    archiveCandidates,
    blockedFromArchival,
    archivedCount: archived.length,
    pendingCount: pendingArchival.length,
  };
}

/**
 * Run maintenance scan loading data from DB.
 */
export async function runMaintenanceScanFromDb(): Promise<MaintenanceReport> {
  const tasks = await getAllTasks();
  const entriesByTask = new Map<string, TimeEntry[]>();

  for (const task of tasks) {
    const entries = await getTimeEntriesByTask(task.id);
    if (entries.length > 0) {
      entriesByTask.set(task.id, entries);
    }
  }

  return runMaintenanceScan(tasks, entriesByTask);
}

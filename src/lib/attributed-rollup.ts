/**
 * Attributed rollup — builds an attribution-aware entries map for KPI/Calculator paths.
 * Replaces buildRolledUpEntriesMap usage with attribution-engine-backed grouping.
 */

import type { Task, AttributedEntry, AttributionSummary, AttributionPolicy } from './types';
import { DEFAULT_ATTRIBUTION_POLICY } from './types';
import { getTimeEntriesByTask } from './db';
import { attributeEntries } from './attribution/engine';

export interface AttributedRollup {
  entriesByTask: Map<string, AttributedEntry[]>;
  summary: AttributionSummary;
  allAttributed: AttributedEntry[];
}

/**
 * Build an attributed rollup for qualifying tasks and their subtasks.
 * Fetches entries, runs attribution engine, groups results by ownerTaskId.
 */
export async function buildAttributedRollup(
  qualifyingTasks: Task[],
  allTasks: Task[],
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): Promise<AttributedRollup> {
  // Collect all task IDs we need entries for (qualifying + their subtasks)
  const qualifyingIds = new Set(qualifyingTasks.map((t) => t.id));
  const taskIdsToFetch = new Set<string>();

  for (const task of qualifyingTasks) {
    taskIdsToFetch.add(task.id);
    // Add subtasks of qualifying tasks
    for (const t of allTasks) {
      if (t.parentId === task.id) {
        taskIdsToFetch.add(t.id);
      }
    }
  }

  // Fetch all entries
  const allEntries = [];
  for (const id of taskIdsToFetch) {
    const entries = await getTimeEntriesByTask(id);
    allEntries.push(...entries);
  }

  // Build task map for attribution engine
  const taskMap = new Map<string, Task>();
  for (const t of allTasks) {
    taskMap.set(t.id, t);
  }

  // Run attribution
  const { results, summary } = attributeEntries(allEntries, taskMap, policy);

  // Group by ownerTaskId (only for entries attributed to qualifying tasks)
  const entriesByTask = new Map<string, AttributedEntry[]>();
  for (const entry of results) {
    if (entry.ownerTaskId && qualifyingIds.has(entry.ownerTaskId)) {
      const existing = entriesByTask.get(entry.ownerTaskId);
      if (existing) {
        existing.push(entry);
      } else {
        entriesByTask.set(entry.ownerTaskId, [entry]);
      }
    }
  }

  return { entriesByTask, summary, allAttributed: results };
}

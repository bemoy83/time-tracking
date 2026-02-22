/**
 * Attribution engine v1 — deterministic, pure-function attribution
 * of time entries to measurable tasks.
 *
 * Walks the one-level task hierarchy (self → parent) to find the
 * measurable task that "owns" each time entry.
 *
 * Supports policy-gated heuristics for resolving ambiguous/unattributed entries.
 */

import type {
  Task,
  TimeEntry,
  AttributionStatus,
  AttributionReason,
  AttributedEntry,
  AttributionSummary,
  AttributionPolicy,
} from '../types';
import { durationMs, DEFAULT_ATTRIBUTION_POLICY } from '../types';

export const ENGINE_VERSION = 'v1';

// --- Heuristic types ---

type HeuristicName = 'exact-match' | 'category-match' | 'none';

interface HeuristicResult {
  suggestedOwnerTaskId: string | null;
  heuristicUsed: HeuristicName;
}

/** A task is measurable when it has quantity, unit, and a WorkType (or legacy category). */
export function isMeasurable(task: Task): boolean {
  return (
    task.workQuantity != null &&
    task.workQuantity > 0 &&
    task.workUnit != null &&
    (task.workTypeId != null || task.workCategory != null)
  );
}

/** Walk self → parent to find the measurable owner of a task. */
export function findMeasurableOwner(
  task: Task,
  allTasks: Task[],
): {
  ownerTaskId: string | null;
  status: AttributionStatus;
  reason: AttributionReason;
} {
  // Self check first — logged task takes priority
  if (isMeasurable(task)) {
    return { ownerTaskId: task.id, status: 'attributed', reason: 'self' };
  }

  // Walk to parent (one-level hierarchy)
  if (task.parentId) {
    const parent = allTasks.find((t) => t.id === task.parentId);
    if (parent && isMeasurable(parent)) {
      return { ownerTaskId: parent.id, status: 'attributed', reason: 'ancestor' };
    }
  }

  // No measurable owner found
  return { ownerTaskId: null, status: 'unattributed', reason: 'noMeasurableOwner' };
}

/**
 * Deterministic heuristic resolver chain for unattributed/ambiguous entries.
 * Heuristic 1: measurable task with exact WorkType/legacy key match → 'exact-match'
 * Heuristic 2: measurable task with legacy category + unit match → 'category-match'
 * Otherwise: no suggestion.
 */
export function resolveWithHeuristics(
  task: Task,
  allTasks: Task[],
): HeuristicResult {
  const measurable = allTasks
    .filter((t) => t.id !== task.id && isMeasurable(t))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (measurable.length === 0) {
    return { suggestedOwnerTaskId: null, heuristicUsed: 'none' };
  }

  const sameProject = task.projectId != null
    ? measurable.filter((t) => t.projectId === task.projectId)
    : [];
  const pool = sameProject.length > 0 ? sameProject : measurable;

  // Heuristic 0: workTypeId match (strongest signal)
  if (task.workTypeId != null) {
    const byWorkType = pool.find((t) => t.workTypeId === task.workTypeId);
    if (byWorkType) {
      return { suggestedOwnerTaskId: byWorkType.id, heuristicUsed: 'exact-match' };
    }
  }

  // Heuristic 1: exact legacy match on category + unit + phase
  if (task.workCategory != null && task.workUnit != null && task.buildPhase != null) {
    const byLegacyExact = pool.find(
      (t) =>
        t.workCategory === task.workCategory &&
        t.workUnit === task.workUnit &&
        t.buildPhase === task.buildPhase,
    );
    if (byLegacyExact) {
      return { suggestedOwnerTaskId: byLegacyExact.id, heuristicUsed: 'exact-match' };
    }
  }

  // Heuristic 2: category + unit match (phase may differ)
  if (task.workCategory != null && task.workUnit != null) {
    const byLegacyCategory = pool.find(
      (t) =>
        t.workCategory === task.workCategory &&
        t.workUnit === task.workUnit,
    );
    if (byLegacyCategory) {
      return { suggestedOwnerTaskId: byLegacyCategory.id, heuristicUsed: 'category-match' };
    }
  }

  return { suggestedOwnerTaskId: null, heuristicUsed: 'none' };
}

/** Attribute a single time entry to its measurable owner. */
export function attributeEntry(
  entry: TimeEntry,
  tasks: Map<string, Task>,
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): AttributedEntry {
  const task = tasks.get(entry.taskId);

  if (!task) {
    return {
      entryId: entry.id,
      taskId: entry.taskId,
      ownerTaskId: null,
      status: 'unattributed',
      reason: 'noMeasurableOwner',
      personHours: computePersonHours(entry),
      suggestedOwnerTaskId: null,
      heuristicUsed: null,
    };
  }

  const allTasks = Array.from(tasks.values());
  const { ownerTaskId, status, reason } = findMeasurableOwner(task, allTasks);

  // If directly attributed, no heuristics needed
  if (status === 'attributed') {
    return {
      entryId: entry.id,
      taskId: entry.taskId,
      ownerTaskId,
      status,
      reason,
      personHours: computePersonHours(entry),
      suggestedOwnerTaskId: null,
      heuristicUsed: null,
    };
  }

  // Unattributed or ambiguous — run heuristics
  const heuristic = resolveWithHeuristics(task, allTasks);

  // Under soft_allow_pick_nearest: apply suggestion to ownerTaskId/status
  if (policy === 'soft_allow_pick_nearest' && heuristic.suggestedOwnerTaskId) {
    return {
      entryId: entry.id,
      taskId: entry.taskId,
      ownerTaskId: heuristic.suggestedOwnerTaskId,
      status: 'attributed',
      reason,
      personHours: computePersonHours(entry),
      suggestedOwnerTaskId: heuristic.suggestedOwnerTaskId,
      heuristicUsed: heuristic.heuristicUsed,
    };
  }

  // soft_allow_flag / strict_block: suggestion-only (no KPI impact)
  return {
    entryId: entry.id,
    taskId: entry.taskId,
    ownerTaskId,
    status,
    reason,
    personHours: computePersonHours(entry),
    suggestedOwnerTaskId: heuristic.suggestedOwnerTaskId,
    heuristicUsed: heuristic.heuristicUsed === 'none' ? null : heuristic.heuristicUsed,
  };
}

/** Batch-attribute entries and produce a summary. */
export function attributeEntries(
  entries: TimeEntry[],
  tasks: Map<string, Task>,
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): { results: AttributedEntry[]; summary: AttributionSummary } {
  const results = entries.map((e) => attributeEntry(e, tasks, policy));

  let attributed = 0;
  let unattributed = 0;
  let ambiguous = 0;
  let totalPersonHours = 0;
  let attributedPersonHours = 0;
  let excludedPersonHours = 0;
  let ambiguousSuggestedResolutions = 0;
  let ambiguousResolvedByPolicy = 0;

  for (const r of results) {
    totalPersonHours += r.personHours;

    switch (r.status) {
      case 'attributed':
        attributed++;
        attributedPersonHours += r.personHours;
        // Check if this was resolved by policy (heuristic applied)
        if (r.heuristicUsed) {
          ambiguousResolvedByPolicy++;
        }
        break;
      case 'unattributed':
        unattributed++;
        excludedPersonHours += r.personHours;
        if (r.suggestedOwnerTaskId) {
          ambiguousSuggestedResolutions++;
        }
        break;
      case 'ambiguous':
        ambiguous++;
        excludedPersonHours += r.personHours;
        if (r.suggestedOwnerTaskId) {
          ambiguousSuggestedResolutions++;
        }
        break;
    }
  }

  return {
    results,
    summary: {
      engineVersion: ENGINE_VERSION,
      totalEntries: results.length,
      attributed,
      unattributed,
      ambiguous,
      totalPersonHours,
      attributedPersonHours,
      excludedPersonHours,
      ambiguousSuggestedResolutions,
      ambiguousResolvedByPolicy,
    },
  };
}

function computePersonHours(entry: TimeEntry): number {
  const ms = durationMs(entry.startUtc, entry.endUtc);
  const hours = ms / 3_600_000;
  return hours * entry.workers;
}

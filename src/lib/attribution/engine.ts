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

type HeuristicName = 'exact-worktype' | 'unit-phase' | 'nearest' | 'none';

interface HeuristicResult {
  suggestedOwnerTaskId: string | null;
  heuristicUsed: HeuristicName;
}

/** A task has quantity context when it has quantity and unit (sufficient for self-ownership). */
export function taskHasQuantityContext(task: Task): boolean {
  return task.workQuantity != null && task.workQuantity > 0 && task.workUnit != null;
}

/** A task is measurable when it has quantity, unit, and a WorkType link. */
export function isMeasurable(task: Task): boolean {
  return taskHasQuantityContext(task) && task.workTypeId != null;
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
  // Self check first — a task with quantity context owns its own entries
  if (taskHasQuantityContext(task)) {
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
 * Deterministic heuristic resolver chain for unattributed entries.
 * Ranking:
 * 1) exact workTypeId
 * 2) unit + buildPhase compatibility
 * 3) nearest measurable in selected pool
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

  // 1) Exact workType match (strongest signal)
  if (task.workTypeId != null) {
    const byWorkType = pool.find((t) => t.workTypeId === task.workTypeId);
    if (byWorkType) {
      return { suggestedOwnerTaskId: byWorkType.id, heuristicUsed: 'exact-worktype' };
    }
  }

  // 2) Unit + phase compatibility
  if (task.workUnit != null && task.buildPhase != null) {
    const byUnitAndPhase = pool.find(
      (t) =>
        t.workUnit === task.workUnit &&
        t.buildPhase === task.buildPhase,
    );
    if (byUnitAndPhase) {
      return { suggestedOwnerTaskId: byUnitAndPhase.id, heuristicUsed: 'unit-phase' };
    }
  }

  // 3) Nearest measurable fallback in deterministic pool order
  const nearest = pool[0];
  if (nearest) {
    return { suggestedOwnerTaskId: nearest.id, heuristicUsed: 'nearest' };
  }

  return { suggestedOwnerTaskId: null, heuristicUsed: 'none' };
}

/** Attribute a single time entry to its measurable owner. */
export function attributeEntry(
  entry: TimeEntry,
  tasks: Map<string, Task>,
  policy: AttributionPolicy = DEFAULT_ATTRIBUTION_POLICY,
): AttributedEntry {
  const entryDurationMs = durationMs(entry.startUtc, entry.endUtc);
  const entryPersonHours = computePersonHours(entryDurationMs, entry.workers);
  const task = tasks.get(entry.taskId);

  if (!task) {
    return {
      entryId: entry.id,
      taskId: entry.taskId,
      ownerTaskId: null,
      status: 'unattributed',
      reason: 'noMeasurableOwner',
      durationMs: entryDurationMs,
      personHours: entryPersonHours,
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
      durationMs: entryDurationMs,
      personHours: entryPersonHours,
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
      reason: 'policySuggestedOwner',
      durationMs: entryDurationMs,
      personHours: entryPersonHours,
      suggestedOwnerTaskId: heuristic.suggestedOwnerTaskId,
      heuristicUsed: heuristic.heuristicUsed,
    };
  }

  // strict_block: no suggestion metadata
  if (policy === 'strict_block') {
    return {
      entryId: entry.id,
      taskId: entry.taskId,
      ownerTaskId,
      status,
      reason,
      durationMs: entryDurationMs,
      personHours: entryPersonHours,
      suggestedOwnerTaskId: null,
      heuristicUsed: null,
    };
  }

  // soft_allow_flag: suggestion-only (no KPI impact)
  return {
    entryId: entry.id,
    taskId: entry.taskId,
    ownerTaskId,
    status,
    reason,
    durationMs: entryDurationMs,
    personHours: entryPersonHours,
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

function computePersonHours(entryDurationMs: number, workers: number): number {
  const hours = entryDurationMs / 3_600_000;
  return hours * workers;
}

/**
 * Issue queue — categorizes data quality issues from attribution results
 * into actionable remediation queues.
 *
 * Three queue categories:
 * 1. "Needs measurable owner" — unattributed entries (no measurable task in hierarchy)
 * 2. "Ambiguous owner" — entries with heuristic suggestions not yet applied
 * 3. "No work context" — completed tasks missing workType/workUnit/workQuantity
 */

import type { Task, AttributedEntry } from '../types';
import { isMeasurable, taskHasQuantityContext } from '../attribution/engine';

export type IssueCategory =
  | 'needs_measurable_owner'
  | 'ambiguous_owner'
  | 'no_work_context';

export interface BaseIssueItem {
  /** Scope task that should be classified/fixed for this issue cluster. */
  taskId: string;
  /** Alias of taskId for readability in remediation flows. */
  scopeTaskId: string;
  entryId: string | null;
  /** All entries represented by this issue item (grouped by scope task). */
  entryIds: string[];
  /** Number of entries represented by this issue item. */
  entryCount: number;
  taskTitle: string;
  /** Human-readable description of the issue. */
  description: string;
  /** Person-hours affected by this issue. */
  personHours: number;
}

export interface NeedsMeasurableOwnerItem extends BaseIssueItem {
  category: 'needs_measurable_owner';
  /** Suggested fix target (taskId to reassign to, or null). */
  suggestedTargetId: string | null;
  suggestedTargetTitle: string | null;
  /** Suggested WorkType classification target. */
  recommendedWorkTypeId: string | null;
  /** Recommended WorkType conflict set for manual decision. */
  conflictingRecommendedWorkTypeIds: string[];
  /** Where the suggestion came from. */
  suggestionSource: 'engine' | 'nearest' | null;
}

export interface AmbiguousOwnerItem extends BaseIssueItem {
  category: 'ambiguous_owner';
  /** Suggested fix target (taskId to reassign to, or null). */
  suggestedTargetId: string | null;
  suggestedTargetTitle: string | null;
  /** Suggested WorkType classification target. */
  recommendedWorkTypeId: string | null;
  /** Recommended WorkType conflict set for manual decision. */
  conflictingRecommendedWorkTypeIds: string[];
  /** Where the suggestion came from. */
  suggestionSource: 'engine' | 'nearest' | null;
}

export interface NoWorkContextItem extends BaseIssueItem {
  category: 'no_work_context';
  missingFields: ('work type' | 'work unit' | 'work quantity')[];
}

export type EntryLevelIssueItem = NeedsMeasurableOwnerItem | AmbiguousOwnerItem;
export type IssueQueueItem = EntryLevelIssueItem | NoWorkContextItem;

export interface IssueQueueResult {
  needsMeasurableOwner: NeedsMeasurableOwnerItem[];
  ambiguousOwner: AmbiguousOwnerItem[];
  noWorkContext: NoWorkContextItem[];
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

  const getRecommendedWorkTypeId = (
    sourceTask: Task | undefined,
    suggestedTask: Task | undefined,
  ): string | null => sourceTask?.workTypeId ?? suggestedTask?.workTypeId ?? null;

  type RawIssue = Omit<
    EntryLevelIssueItem,
    'entryIds' | 'entryCount' | 'entryId' | 'conflictingRecommendedWorkTypeIds'
  > & {
    entryId: string;
  };
  interface GroupAccumulator {
    category: EntryLevelIssueItem['category'];
    taskId: string;
    scopeTaskId: string;
    taskTitle: string;
    description: string;
    personHours: number;
    entryIds: Set<string>;
    recommendationIds: Set<string>;
    suggestionSources: Set<'engine' | 'nearest'>;
    suggestedTargetIds: Set<string>;
    suggestedTargetTitles: Set<string>;
  }

  const needsRaw: RawIssue[] = [];
  const ambiguousRaw: RawIssue[] = [];
  const noWorkContext: NoWorkContextItem[] = [];
  const entriesByOwner = new Map<string, AttributedEntry[]>();

  // 1 & 2: Scan attributed entries for unattributed / ambiguous
  for (const entry of attributedEntries) {
    // Index attributed entries by ownerTaskId so noWorkContext items
    // can surface actual hours and entry counts for actionable cards.
    if (entry.status === 'attributed' && entry.ownerTaskId) {
      const list = entriesByOwner.get(entry.ownerTaskId);
      if (list) list.push(entry);
      else entriesByOwner.set(entry.ownerTaskId, [entry]);
    }

    const sourceTask = taskMap.get(entry.taskId);
    const scopeTask = sourceTask
      ? resolveClassificationScopeTask(sourceTask, taskMap)
      : null;
    const scopeTaskId = scopeTask?.id ?? entry.taskId;
    const scopeTaskTitle = scopeTask?.title ?? entry.taskId;

    if (entry.status === 'unattributed') {
      if (entry.suggestedOwnerTaskId) {
        // Has suggestion but not applied → ambiguous owner
        const suggestedTask = taskMap.get(entry.suggestedOwnerTaskId);
        ambiguousRaw.push({
          category: 'ambiguous_owner',
          taskId: scopeTaskId,
          scopeTaskId,
          entryId: entry.entryId,
          taskTitle: scopeTaskTitle,
          description: `Entry has a suggested owner but was not auto-applied`,
          suggestedTargetId: entry.suggestedOwnerTaskId,
          suggestedTargetTitle: suggestedTask?.title ?? entry.suggestedOwnerTaskId,
          recommendedWorkTypeId: getRecommendedWorkTypeId(scopeTask ?? sourceTask, suggestedTask),
          suggestionSource: 'engine',
          personHours: entry.personHours,
        });
      } else {
        // No engine suggestion → needs measurable owner (try nearest measurable fallback)
        const nearest = findNearestMeasurable(entry.taskId, tasks);
        const nearestTask = nearest ? taskMap.get(nearest.targetId) : undefined;
        needsRaw.push({
          category: 'needs_measurable_owner',
          taskId: scopeTaskId,
          scopeTaskId,
          entryId: entry.entryId,
          taskTitle: scopeTaskTitle,
          description: nearest
            ? `No measurable owner. Suggested nearest measurable task (${nearest.matchType}).`
            : `No measurable task found in hierarchy`,
          suggestedTargetId: nearest?.targetId ?? null,
          suggestedTargetTitle: nearest?.targetTitle ?? null,
          recommendedWorkTypeId: getRecommendedWorkTypeId(scopeTask ?? sourceTask, nearestTask),
          suggestionSource: nearest ? 'nearest' : null,
          personHours: entry.personHours,
        });
      }
    } else if (entry.status === 'ambiguous') {
      const suggestedTask = entry.suggestedOwnerTaskId
        ? taskMap.get(entry.suggestedOwnerTaskId)
        : null;
      ambiguousRaw.push({
        category: 'ambiguous_owner',
        taskId: scopeTaskId,
        scopeTaskId,
        entryId: entry.entryId,
        taskTitle: scopeTaskTitle,
        description: `Multiple valid measurable owners`,
        suggestedTargetId: entry.suggestedOwnerTaskId,
        suggestedTargetTitle: suggestedTask?.title ?? null,
        recommendedWorkTypeId: getRecommendedWorkTypeId(scopeTask ?? sourceTask, suggestedTask ?? undefined),
        suggestionSource: entry.suggestedOwnerTaskId ? 'engine' : null,
        personHours: entry.personHours,
      });
    }
  }

  const groupIssues = (items: RawIssue[]): EntryLevelIssueItem[] => {
    const groups = new Map<string, GroupAccumulator>();
    for (const item of items) {
      const key = `${item.category}:${item.scopeTaskId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.personHours += item.personHours;
        existing.entryIds.add(item.entryId);
        if (item.recommendedWorkTypeId) existing.recommendationIds.add(item.recommendedWorkTypeId);
        if (item.suggestionSource) existing.suggestionSources.add(item.suggestionSource);
        if (item.suggestedTargetId) existing.suggestedTargetIds.add(item.suggestedTargetId);
        if (item.suggestedTargetTitle) existing.suggestedTargetTitles.add(item.suggestedTargetTitle);
      } else {
        const recommendationIds = new Set<string>();
        if (item.recommendedWorkTypeId) recommendationIds.add(item.recommendedWorkTypeId);
        const suggestionSources = new Set<'engine' | 'nearest'>();
        if (item.suggestionSource) suggestionSources.add(item.suggestionSource);
        const suggestedTargetIds = new Set<string>();
        if (item.suggestedTargetId) suggestedTargetIds.add(item.suggestedTargetId);
        const suggestedTargetTitles = new Set<string>();
        if (item.suggestedTargetTitle) suggestedTargetTitles.add(item.suggestedTargetTitle);
        groups.set(key, {
          category: item.category,
          taskId: item.taskId,
          scopeTaskId: item.scopeTaskId,
          taskTitle: item.taskTitle,
          description: item.description,
          personHours: item.personHours,
          entryIds: new Set([item.entryId]),
          recommendationIds,
          suggestionSources,
          suggestedTargetIds,
          suggestedTargetTitles,
        });
      }
    }

    const grouped: EntryLevelIssueItem[] = [];
    for (const group of groups.values()) {
      const entryIds = Array.from(group.entryIds).sort((a, b) => a.localeCompare(b));
      const recommendationIds = Array.from(group.recommendationIds).sort((a, b) => a.localeCompare(b));
      const conflictingRecommendedWorkTypeIds = recommendationIds.length > 1 ? recommendationIds : [];
      const recommendedWorkTypeId = recommendationIds.length === 1 ? recommendationIds[0] : null;
      const suggestionSources = Array.from(group.suggestionSources);
      const suggestedTargetIds = Array.from(group.suggestedTargetIds);
      const suggestedTargetTitles = Array.from(group.suggestedTargetTitles);
      grouped.push({
        category: group.category,
        taskId: group.taskId,
        scopeTaskId: group.scopeTaskId,
        entryId: entryIds.length === 1 ? entryIds[0] : null,
        entryIds,
        entryCount: entryIds.length,
        taskTitle: group.taskTitle,
        description: group.description,
        suggestedTargetId: suggestedTargetIds.length === 1 ? suggestedTargetIds[0] : null,
        suggestedTargetTitle: suggestedTargetTitles.length === 1 ? suggestedTargetTitles[0] : null,
        recommendedWorkTypeId,
        conflictingRecommendedWorkTypeIds,
        suggestionSource: suggestionSources.length === 1 ? suggestionSources[0] : null,
        personHours: group.personHours,
      });
    }
    return grouped;
  };

  const needsMeasurableOwner = groupIssues(needsRaw) as NeedsMeasurableOwnerItem[];
  const ambiguousOwner = groupIssues(ambiguousRaw) as AmbiguousOwnerItem[];

  // 3: Scan completed tasks for missing work context
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    if (task.parentId != null) continue; // subtasks inherit from parent
    if (isMeasurable(task)) continue;

    const missingFields: NoWorkContextItem['missingFields'] = [];
    if (task.workTypeId == null) missingFields.push('work type');
    if (task.workUnit == null) missingFields.push('work unit');
    if (task.workQuantity == null || task.workQuantity <= 0) missingFields.push('work quantity');

    const ownedEntries = entriesByOwner.get(task.id) ?? [];
    const entryIds = ownedEntries.map((e) => e.entryId).sort();
    const entryPersonHours = ownedEntries.reduce((sum, e) => sum + e.personHours, 0);

    noWorkContext.push({
      category: 'no_work_context',
      taskId: task.id,
      scopeTaskId: task.id,
      entryId: entryIds.length === 1 ? entryIds[0] : null,
      entryIds,
      entryCount: entryIds.length,
      taskTitle: task.title,
      description: `Missing: ${missingFields.join(', ')}`,
      missingFields,
      personHours: entryPersonHours,
    });
  }

  const sortQueue = <T extends IssueQueueItem>(items: T[]) =>
    items.sort((a, b) => {
      const taskCmp = a.taskId.localeCompare(b.taskId);
      if (taskCmp !== 0) return taskCmp;
      return a.category.localeCompare(b.category);
    });

  sortQueue(needsMeasurableOwner);
  sortQueue(ambiguousOwner);
  sortQueue(noWorkContext);

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
 * Resolve the task scope that should own classification changes.
 * Preference:
 * 1) the source task if it owns quantity context
 * 2) nearest measurable parent quantity scope (one-level hierarchy)
 * 3) fallback to the source task
 */
export function resolveClassificationScopeTask(
  task: Task,
  taskMap: Map<string, Task>,
): Task {
  if (taskHasQuantityContext(task)) {
    return task;
  }
  if (task.parentId) {
    const parent = taskMap.get(task.parentId);
    if (parent && taskHasQuantityContext(parent)) {
      return parent;
    }
  }
  return task;
}

/**
 * Find the nearest measurable task for a given task.
 * Searches: parent → sibling tasks in same project → any measurable task with matching WorkType.
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
    const peers = tasks
      .filter(
        (t) =>
          t.id !== taskId &&
          t.projectId === task.projectId &&
          t.parentId == null &&
          isMeasurable(t),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const peer = peers[0];
    if (peer) {
      return { targetId: peer.id, targetTitle: peer.title, matchType: 'project_peer' };
    }
  }

  // 3. Check any measurable task with matching workTypeId
  if (task.workTypeId) {
    const matches = tasks
      .filter(
        (t) =>
          t.id !== taskId &&
          t.parentId == null &&
          isMeasurable(t) &&
          t.workTypeId === task.workTypeId,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const match = matches[0];
    if (match) {
      return { targetId: match.id, targetTitle: match.title, matchType: 'work_type_match' };
    }
  }

  return null;
}

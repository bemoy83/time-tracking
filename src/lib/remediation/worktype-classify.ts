/**
 * Remediation classification actions.
 * Resolves unattributed issues by assigning the source task to a WorkType.
 */

import {
  addTaskNote,
  findWorkTypeByKey as dbFindWorkTypeByKey,
  getTask,
  getTimeEntry,
  getWorkType,
  updateTask,
} from '../db';
import { createWorkType, findWorkTypeByKey as findWorkTypeByCompositeKey } from '../stores/work-type-store';
import { getTaskById, updateTaskFields } from '../stores/task-store';
import {
  createAuditNote,
  generateId,
  nowUtc,
} from '../types';
import type {
  Task,
  TaskNote,
  WorkType,
  WorkUnit,
} from '../types';
import {
  resolveClassificationScopeTask,
  type EntryLevelIssueItem,
} from './issue-queue';

export interface ClassifyEntryToWorkTypeResult {
  entryId: string;
  sourceTaskId: string;
  taskId: string;
  taskTitle: string;
  workTypeId: string;
  workTypeTitle: string;
  warning: 'missing_quantity' | null;
}

export interface ClassifyTaskToWorkTypeResult {
  taskId: string;
  taskTitle: string;
  workTypeId: string;
  workTypeTitle: string;
  warning: 'missing_quantity' | null;
}

export interface CreateAndClassifyInput {
  title?: string;
  workUnit?: WorkUnit;
  assemblyRate?: number;
  dismantleRate?: number;
}

export interface CreateAndClassifyResult extends ClassifyEntryToWorkTypeResult {
  createdWorkTypeId: string;
}

export interface CreateAndClassifyTaskResult extends ClassifyTaskToWorkTypeResult {
  createdWorkTypeId: string;
}

export interface BulkClassifyResult {
  attempted: number;
  succeeded: number;
  failed: Array<{ itemId: string; error: string }>;
}

export class WorkTypeConflictError extends Error {
  readonly existingWorkTypeId: string;

  readonly existingWorkTypeTitle: string;

  constructor(existingWorkType: WorkType) {
    super(
      `WorkType "${existingWorkType.title}" (${existingWorkType.workUnit}) already exists.`,
    );
    this.name = 'WorkTypeConflictError';
    this.existingWorkTypeId = existingWorkType.id;
    this.existingWorkTypeTitle = existingWorkType.title;
  }
}

function requireReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) {
    throw new Error('Reason is required.');
  }
  return normalized;
}

function getMissingQuantityWarning(task: Task): 'missing_quantity' | null {
  if (task.workQuantity == null || task.workQuantity <= 0) {
    return 'missing_quantity';
  }
  return null;
}

async function persistTaskClassification(
  task: Task,
  updates: Pick<Task, 'workTypeId' | 'workUnit' | 'targetProductivity'>,
): Promise<void> {
  const taskInStore = getTaskById(task.id);
  if (taskInStore) {
    await updateTaskFields(task.id, updates);
    return;
  }
  await updateTask({
    ...task,
    ...updates,
    updatedAt: nowUtc(),
  });
}

function resolveTaskUpdates(task: Task, workType: WorkType): Pick<Task, 'workTypeId' | 'workUnit' | 'targetProductivity'> {
  if (task.workUnit != null && task.workUnit !== workType.workUnit) {
    throw new Error(
      `Unit mismatch: task uses ${task.workUnit}, selected WorkType uses ${workType.workUnit}.`,
    );
  }

  const rate = task.buildPhase === 'dismantle' ? workType.dismantleRate : workType.assemblyRate;

  return {
    workTypeId: workType.id,
    workUnit: task.workUnit ?? workType.workUnit,
    targetProductivity: rate || workType.assemblyRate || workType.dismantleRate,
  };
}

async function addClassificationAuditNote(
  taskId: string,
  details: string,
  workType: WorkType,
  reason: string,
): Promise<void> {
  const note: TaskNote = {
    id: generateId(),
    taskId,
    text: createAuditNote(
      'Remediation WorkType assigned',
      `${details} classified as "${workType.title}" (${workType.workUnit}). Reason: ${reason}`,
    ),
    createdAt: nowUtc(),
  };
  await addTaskNote(note);
}

export async function classifyTaskToWorkType(
  taskId: string,
  workTypeId: string,
  reason: string,
  auditDetails: string = 'Task',
): Promise<ClassifyTaskToWorkTypeResult> {
  const normalizedReason = requireReason(reason);
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }

  const workType = await getWorkType(workTypeId);
  if (!workType) {
    throw new Error(`WorkType ${workTypeId} not found.`);
  }

  const taskUpdates = resolveTaskUpdates(task, workType);
  await persistTaskClassification(task, taskUpdates);
  await addClassificationAuditNote(task.id, auditDetails, workType, normalizedReason);

  return {
    taskId: task.id,
    taskTitle: task.title,
    workTypeId: workType.id,
    workTypeTitle: workType.title,
    warning: getMissingQuantityWarning(task),
  };
}

export async function classifyEntryToWorkType(
  entryId: string,
  workTypeId: string,
  reason: string,
): Promise<ClassifyEntryToWorkTypeResult> {
  const normalizedReason = requireReason(reason);

  const entry = await getTimeEntry(entryId);
  if (!entry) {
    throw new Error(`Time entry ${entryId} not found.`);
  }

  const sourceTask = await getTask(entry.taskId);
  if (!sourceTask) {
    throw new Error(`Task ${entry.taskId} not found.`);
  }

  const taskMap = new Map<string, Task>([[sourceTask.id, sourceTask]]);
  if (sourceTask.parentId) {
    const parent = await getTask(sourceTask.parentId);
    if (parent) {
      taskMap.set(parent.id, parent);
    }
  }
  const scopeTask = resolveClassificationScopeTask(sourceTask, taskMap);

  const scoped = await classifyTaskToWorkType(
    scopeTask.id,
    workTypeId,
    normalizedReason,
    `Entry ${entry.id} (source "${sourceTask.title}")`,
  );

  return {
    entryId: entry.id,
    sourceTaskId: sourceTask.id,
    taskId: scoped.taskId,
    taskTitle: scoped.taskTitle,
    workTypeId: scoped.workTypeId,
    workTypeTitle: scoped.workTypeTitle,
    warning: scoped.warning,
  };
}

export async function createAndClassifyFromEntry(
  entryId: string,
  input: CreateAndClassifyInput,
  reason: string,
): Promise<CreateAndClassifyResult> {
  const normalizedReason = requireReason(reason);

  const entry = await getTimeEntry(entryId);
  if (!entry) {
    throw new Error(`Time entry ${entryId} not found.`);
  }

  const task = await getTask(entry.taskId);
  if (!task) {
    throw new Error(`Task ${entry.taskId} not found.`);
  }

  const title = (input.title ?? task.title ?? '').trim();
  if (!title) {
    throw new Error('WorkType title is required.');
  }
  const workUnit = input.workUnit ?? task.workUnit ?? 'm2';
  const defaultRate = task.targetProductivity != null && task.targetProductivity > 0 ? task.targetProductivity : 10;
  const assemblyRate = input.assemblyRate ?? (task.buildPhase !== 'dismantle' ? defaultRate : 0);
  const dismantleRate = input.dismantleRate ?? (task.buildPhase === 'dismantle' ? defaultRate : 0);
  if (assemblyRate <= 0 && dismantleRate <= 0) {
    throw new Error('At least one rate must be greater than 0.');
  }

  const existing = findWorkTypeByCompositeKey(title, workUnit)
    ?? await dbFindWorkTypeByKey(title, workUnit);
  if (existing) {
    throw new WorkTypeConflictError(existing);
  }

  const created = await createWorkType({
    title,
    workUnit,
    assemblyRate,
    dismantleRate,
  });

  const classified = await classifyEntryToWorkType(entryId, created.id, normalizedReason);
  return {
    ...classified,
    createdWorkTypeId: created.id,
  };
}

export async function createAndClassifyFromTask(
  taskId: string,
  input: CreateAndClassifyInput,
  reason: string,
): Promise<CreateAndClassifyTaskResult> {
  const normalizedReason = requireReason(reason);
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }

  const title = (input.title ?? task.title ?? '').trim();
  if (!title) {
    throw new Error('WorkType title is required.');
  }
  const workUnit = input.workUnit ?? task.workUnit ?? 'm2';
  const defaultRate = task.targetProductivity != null && task.targetProductivity > 0 ? task.targetProductivity : 10;
  const assemblyRate = input.assemblyRate ?? (task.buildPhase !== 'dismantle' ? defaultRate : 0);
  const dismantleRate = input.dismantleRate ?? (task.buildPhase === 'dismantle' ? defaultRate : 0);
  if (assemblyRate <= 0 && dismantleRate <= 0) {
    throw new Error('At least one rate must be greater than 0.');
  }

  const existing = findWorkTypeByCompositeKey(title, workUnit)
    ?? await dbFindWorkTypeByKey(title, workUnit);
  if (existing) {
    throw new WorkTypeConflictError(existing);
  }

  const created = await createWorkType({
    title,
    workUnit,
    assemblyRate,
    dismantleRate,
  });

  const classified = await classifyTaskToWorkType(taskId, created.id, normalizedReason);
  return {
    ...classified,
    createdWorkTypeId: created.id,
  };
}

export async function bulkClassifyToRecommendedWorkType(
  items: EntryLevelIssueItem[],
  reason: string,
): Promise<BulkClassifyResult> {
  const grouped = new Map<
    string,
    { recommendationIds: Set<string>; hasConflictFlag: boolean }
  >();

  for (const item of items) {
    if (!item.recommendedWorkTypeId && item.conflictingRecommendedWorkTypeIds.length === 0) {
      continue;
    }
    const current = grouped.get(item.taskId);
    if (current) {
      if (item.recommendedWorkTypeId) {
        current.recommendationIds.add(item.recommendedWorkTypeId);
      }
      if (item.conflictingRecommendedWorkTypeIds.length > 0) {
        current.hasConflictFlag = true;
      }
    } else {
      const recommendationIds = new Set<string>();
      if (item.recommendedWorkTypeId) {
        recommendationIds.add(item.recommendedWorkTypeId);
      }
      grouped.set(item.taskId, {
        recommendationIds,
        hasConflictFlag: item.conflictingRecommendedWorkTypeIds.length > 0,
      });
    }
  }

  const result: BulkClassifyResult = {
    attempted: grouped.size,
    succeeded: 0,
    failed: [],
  };

  for (const [taskId, group] of grouped.entries()) {
    const recommendationIds = Array.from(group.recommendationIds);
    if (group.hasConflictFlag || recommendationIds.length !== 1) {
      result.failed.push({
        itemId: taskId,
        error: 'Conflicting WorkType recommendations in grouped scope. Manual assignment required.',
      });
      continue;
    }

    try {
      await classifyTaskToWorkType(taskId, recommendationIds[0], reason);
      result.succeeded += 1;
    } catch (err) {
      result.failed.push({
        itemId: taskId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

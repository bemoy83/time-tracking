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
  BuildPhase,
  Task,
  TaskNote,
  WorkType,
  WorkUnit,
} from '../types';
import type { IssueQueueItem } from './issue-queue';

export interface ClassifyEntryToWorkTypeResult {
  entryId: string;
  taskId: string;
  taskTitle: string;
  workTypeId: string;
  workTypeTitle: string;
  warning: 'missing_quantity' | null;
}

export interface CreateAndClassifyInput {
  title?: string;
  workUnit?: WorkUnit;
  buildPhase?: BuildPhase;
  expectedProductivity?: number;
}

export interface CreateAndClassifyResult extends ClassifyEntryToWorkTypeResult {
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
      `WorkType "${existingWorkType.title}" (${existingWorkType.workUnit}, ${existingWorkType.buildPhase}) already exists.`,
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
  updates: Pick<Task, 'workTypeId' | 'workUnit' | 'buildPhase' | 'targetProductivity'>,
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

function resolveTaskUpdates(task: Task, workType: WorkType): Pick<Task, 'workTypeId' | 'workUnit' | 'buildPhase' | 'targetProductivity'> {
  if (task.workUnit != null && task.workUnit !== workType.workUnit) {
    throw new Error(
      `Unit mismatch: task uses ${task.workUnit}, selected WorkType uses ${workType.workUnit}.`,
    );
  }
  if (task.buildPhase != null && task.buildPhase !== workType.buildPhase) {
    throw new Error(
      `Build phase mismatch: task uses ${task.buildPhase}, selected WorkType uses ${workType.buildPhase}.`,
    );
  }

  return {
    workTypeId: workType.id,
    workUnit: task.workUnit ?? workType.workUnit,
    buildPhase: task.buildPhase ?? workType.buildPhase,
    targetProductivity: workType.expectedProductivity,
  };
}

async function addClassificationAuditNote(
  taskId: string,
  entryId: string,
  workType: WorkType,
  reason: string,
): Promise<void> {
  const note: TaskNote = {
    id: generateId(),
    taskId,
    text: createAuditNote(
      'Remediation WorkType assigned',
      `Entry ${entryId} classified as "${workType.title}" (${workType.workUnit}, ${workType.buildPhase}). Reason: ${reason}`,
    ),
    createdAt: nowUtc(),
  };
  await addTaskNote(note);
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

  const task = await getTask(entry.taskId);
  if (!task) {
    throw new Error(`Task ${entry.taskId} not found.`);
  }

  const workType = await getWorkType(workTypeId);
  if (!workType) {
    throw new Error(`WorkType ${workTypeId} not found.`);
  }

  const taskUpdates = resolveTaskUpdates(task, workType);
  await persistTaskClassification(task, taskUpdates);
  await addClassificationAuditNote(task.id, entry.id, workType, normalizedReason);

  return {
    entryId: entry.id,
    taskId: task.id,
    taskTitle: task.title,
    workTypeId: workType.id,
    workTypeTitle: workType.title,
    warning: getMissingQuantityWarning(task),
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
  const buildPhase = input.buildPhase ?? task.buildPhase ?? 'build-up';
  const expectedProductivity = input.expectedProductivity
    ?? (task.targetProductivity != null && task.targetProductivity > 0 ? task.targetProductivity : 10);
  if (!Number.isFinite(expectedProductivity) || expectedProductivity <= 0) {
    throw new Error('Expected productivity must be greater than 0.');
  }

  const existing = findWorkTypeByCompositeKey(title, workUnit, buildPhase)
    ?? await dbFindWorkTypeByKey(title, workUnit, buildPhase);
  if (existing) {
    throw new WorkTypeConflictError(existing);
  }

  const created = await createWorkType({
    title,
    workUnit,
    buildPhase,
    expectedProductivity,
  });

  const classified = await classifyEntryToWorkType(entryId, created.id, normalizedReason);
  return {
    ...classified,
    createdWorkTypeId: created.id,
  };
}

export async function bulkClassifyToRecommendedWorkType(
  items: IssueQueueItem[],
  reason: string,
): Promise<BulkClassifyResult> {
  const eligible = items.filter((item) => item.entryId != null && item.recommendedWorkTypeId != null);
  const result: BulkClassifyResult = {
    attempted: eligible.length,
    succeeded: 0,
    failed: [],
  };

  for (const item of eligible) {
    try {
      await classifyEntryToWorkType(item.entryId!, item.recommendedWorkTypeId!, reason);
      result.succeeded += 1;
    } catch (err) {
      result.failed.push({
        itemId: item.entryId!,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

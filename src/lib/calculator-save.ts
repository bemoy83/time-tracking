/**
 * Save a calculator recommendation to a task with full audit trail.
 * Keeps output advisory — values are written but user can override later.
 */

import { getTask, updateTask, addTaskNote, getTaskTemplate, updateTaskTemplate, addTemplateNote } from './db';
import { generateId, nowUtc, createAuditNote, formatProductivity } from './types';
import type { Task, TaskNote, TemplateNote, TaskTemplate, WorkUnit } from './types';

export interface SaveRecommendationParams {
  taskId: string;
  type: 'crew' | 'time';
  /** For crew recommendations */
  crewValue?: number;
  /** For time recommendations (minutes) */
  estimatedMinutes?: number;
  /** Provenance */
  rateUsed: number;
  rateSource: 'template' | 'historical' | 'manual';
  workUnit: WorkUnit;
  quantityUsed: number;
  sampleCount: number | null;
}

type RecommendationPayload = Omit<SaveRecommendationParams, 'taskId'>;

export async function saveRecommendationToTask(params: SaveRecommendationParams): Promise<void> {
  const task = await getTask(params.taskId);
  if (!task) throw new Error(`Task ${params.taskId} not found`);

  const updated: Task = { ...task, updatedAt: nowUtc() };

  const rateLabel = formatProductivity(params.rateUsed, params.workUnit);
  const sourceLabel = params.rateSource === 'template'
    ? 'template target'
    : params.rateSource === 'historical'
      ? `historical avg (${params.sampleCount ?? '?'} tasks)`
      : 'manual rate';

  let actionDetail: string;

  if (params.type === 'crew' && params.crewValue != null) {
    updated.defaultWorkers = params.crewValue;
    actionDetail = `Set crew to ${params.crewValue} workers. Based on ${rateLabel} from ${sourceLabel}, for ${params.quantityUsed} units.`;
  } else if (params.type === 'time' && params.estimatedMinutes != null) {
    updated.estimatedMinutes = params.estimatedMinutes;
    actionDetail = `Set estimate to ${params.estimatedMinutes}m. Based on ${rateLabel} from ${sourceLabel}, for ${params.quantityUsed} units.`;
  } else {
    throw new Error('Invalid recommendation type');
  }

  await updateTask(updated);

  const note: TaskNote = {
    id: generateId(),
    taskId: params.taskId,
    text: createAuditNote('Calculator recommendation applied', actionDetail),
    createdAt: nowUtc(),
  };
  await addTaskNote(note);
}

export interface SaveRecommendationTemplateParams extends Omit<SaveRecommendationParams, 'taskId'> {
  templateId: string;
}

function applyRecommendationToTarget<T extends Pick<TaskTemplate, 'defaultWorkers' | 'estimatedMinutes'>>(
  target: T,
  params: RecommendationPayload,
): { updated: T; actionDetail: string } {
  const rateLabel = formatProductivity(params.rateUsed, params.workUnit);
  const sourceLabel = params.rateSource === 'template'
    ? 'template target'
    : params.rateSource === 'historical'
      ? `historical avg (${params.sampleCount ?? '?'} tasks)`
      : 'manual rate';

  if (params.type === 'crew' && params.crewValue != null) {
    return {
      updated: { ...target, defaultWorkers: params.crewValue },
      actionDetail: `Set crew to ${params.crewValue} workers. Based on ${rateLabel} from ${sourceLabel}, for ${params.quantityUsed} units.`,
    };
  }
  if (params.type === 'time' && params.estimatedMinutes != null) {
    return {
      updated: { ...target, estimatedMinutes: params.estimatedMinutes },
      actionDetail: `Set estimate to ${params.estimatedMinutes}m. Based on ${rateLabel} from ${sourceLabel}, for ${params.quantityUsed} units.`,
    };
  }
  throw new Error('Invalid recommendation type');
}

export async function saveRecommendationToTemplate(
  params: SaveRecommendationTemplateParams,
): Promise<void> {
  const template = await getTaskTemplate(params.templateId);
  if (!template) throw new Error(`Template ${params.templateId} not found`);

  const { updated: partial, actionDetail } = applyRecommendationToTarget(template, params);
  const updated: TaskTemplate = {
    ...template,
    ...partial,
    updatedAt: nowUtc(),
  };
  await updateTaskTemplate(updated);

  const note: TemplateNote = {
    id: generateId(),
    templateId: params.templateId,
    text: createAuditNote('Calculator recommendation applied', actionDetail),
    createdAt: nowUtc(),
  };
  await addTemplateNote(note);
}

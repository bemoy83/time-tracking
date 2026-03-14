import {
  type BuildPhase,
  type Task,
  type TaskTemplate,
  type WorkType,
  normalizeWorkTypeTitle,
} from '../types';
import { getState as getTaskState, updateTaskFields } from '../stores/task-store';
import { getSnapshot as getTemplateSnapshot, updateTemplate } from '../stores/template-store';
import { getSnapshot as getWorkTypeSnapshot, findWorkTypeByKey } from '../stores/work-type-store';

export interface BackfillReport {
  ran: boolean;
  scanned: number;
  updated: number;
  skipped: number;
  ambiguous: number;
  taskUpdates: number;
  templateUpdates: number;
}

let hasRunWorkTypeBackfill = false;

type ResolveResult =
  | { status: 'resolved'; workType: WorkType }
  | { status: 'ambiguous' }
  | { status: 'missing' };

function findByTitleUnit(
  title: string,
  unit: WorkType['workUnit'],
  workTypes: WorkType[],
): WorkType[] {
  const normalized = normalizeWorkTypeTitle(title);
  return workTypes.filter(
    (wt) => normalizeWorkTypeTitle(wt.title) === normalized && wt.workUnit === unit,
  );
}

function resolveWorkType(
  title: string,
  workUnit: WorkType['workUnit'] | null,
  _phase: BuildPhase | null,
  workTypes: WorkType[],
): ResolveResult {
  if (!workUnit) return { status: 'missing' };

  const exact = findWorkTypeByKey(title, workUnit);
  if (exact) {
    return { status: 'resolved', workType: exact };
  }
  const candidates = findByTitleUnit(title, workUnit, workTypes);
  if (candidates.length === 1) return { status: 'resolved', workType: candidates[0] };
  if (candidates.length > 1) return { status: 'ambiguous' };
  return { status: 'missing' };
}

async function applyTaskBackfill(task: Task, workType: WorkType): Promise<void> {
  const rate = task.phase === 'dismantle' ? workType.dismantleRate : workType.assemblyRate;
  await updateTaskFields(task.id, {
    workTypeId: workType.id,
    workUnit: task.workUnit ?? workType.workUnit,
    targetProductivity:
      task.targetProductivity != null && task.targetProductivity > 0
        ? task.targetProductivity
        : (rate || workType.assemblyRate || workType.dismantleRate),
  });
}

async function applyTemplateBackfill(template: TaskTemplate, workType: WorkType): Promise<void> {
  const rate = template.phase === 'dismantle' ? workType.dismantleRate : workType.assemblyRate;
  await updateTemplate(template.id, {
    workTypeId: workType.id,
    workUnit: template.workUnit ?? workType.workUnit,
    targetProductivity:
      template.targetProductivity != null && template.targetProductivity > 0
        ? template.targetProductivity
        : (rate || workType.assemblyRate || workType.dismantleRate),
  });
}

export async function runWorkTypeLinkBackfill(): Promise<BackfillReport> {
  if (hasRunWorkTypeBackfill) {
    return {
      ran: false,
      scanned: 0,
      updated: 0,
      skipped: 0,
      ambiguous: 0,
      taskUpdates: 0,
      templateUpdates: 0,
    };
  }

  hasRunWorkTypeBackfill = true;

  const workTypes = getWorkTypeSnapshot().workTypes;
  if (workTypes.length === 0) {
    const taskCandidates = getTaskState().tasks.filter((task) => task.workTypeId == null).length;
    const templateCandidates = getTemplateSnapshot().templates.filter((template) => template.workTypeId == null).length;
    const scanned = taskCandidates + templateCandidates;
    return {
      ran: true,
      scanned,
      updated: 0,
      skipped: scanned,
      ambiguous: 0,
      taskUpdates: 0,
      templateUpdates: 0,
    };
  }

  const tasks = getTaskState().tasks;
  const templates = getTemplateSnapshot().templates;

  const taskCandidates = tasks.filter((task) => task.workTypeId == null && task.workUnit != null);
  const templateCandidates = templates.filter(
    (template) => template.workTypeId == null && template.workUnit != null,
  );

  let updated = 0;
  let skipped = 0;
  let ambiguous = 0;
  let taskUpdates = 0;
  let templateUpdates = 0;

  for (const task of taskCandidates) {
    const resolved = resolveWorkType(
      task.title,
      task.workUnit,
      task.phase,
      workTypes,
    );
    if (resolved.status === 'resolved') {
      await applyTaskBackfill(task, resolved.workType);
      updated += 1;
      taskUpdates += 1;
      continue;
    }
    if (resolved.status === 'ambiguous') {
      ambiguous += 1;
    } else {
      skipped += 1;
    }
  }

  for (const template of templateCandidates) {
    const resolved = resolveWorkType(
      template.title,
      template.workUnit,
      template.phase,
      workTypes,
    );
    if (resolved.status === 'resolved') {
      await applyTemplateBackfill(template, resolved.workType);
      updated += 1;
      templateUpdates += 1;
      continue;
    }
    if (resolved.status === 'ambiguous') {
      ambiguous += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    ran: true,
    scanned: taskCandidates.length + templateCandidates.length,
    updated,
    skipped,
    ambiguous,
    taskUpdates,
    templateUpdates,
  };
}

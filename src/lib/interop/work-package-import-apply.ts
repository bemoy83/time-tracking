import { updateTaskFields } from '../stores/task-store';
import { createTemplate, updateTemplate } from '../stores/template-store';
import { ensureImportedWorkUnits } from '../stores/work-unit-store';
import { ensureWorkTypeExistsOrCreate } from '../stores/work-type-store';
import type { ImportedWorkPackage } from './import';
import type { ImportPreviewItem } from './import-preview';
import { provisionWorkUnitsForImport } from './work-unit-import';

export interface WorkPackageImportApplyResult {
  created: number;
  updated: number;
  skipped: number;
  unitsCreated: number;
  unitLabelsUpdated: number;
}

export interface WorkPackageImportApplyDeps {
  ensureImportedWorkUnitsFn?: typeof ensureImportedWorkUnits;
  ensureWorkTypeExistsOrCreateFn?: (
    title: string,
    workUnit: ImportedWorkPackage['workUnit'],
    defaultBuildUpRate?: number,
    defaultTearDownRate?: number,
  ) => Promise<string>;
  updateTemplateFn?: typeof updateTemplate;
  updateTaskFieldsFn?: typeof updateTaskFields;
  createTemplateFn?: typeof createTemplate;
}

export async function applyWorkPackageImportItems(
  items: ImportPreviewItem[],
  deps: WorkPackageImportApplyDeps = {},
): Promise<WorkPackageImportApplyResult> {
  const ensureImportedWorkUnitsFn = deps.ensureImportedWorkUnitsFn ?? ensureImportedWorkUnits;
  const ensureWorkTypeExistsOrCreateFn = deps.ensureWorkTypeExistsOrCreateFn ?? ensureWorkTypeExistsOrCreate;
  const updateTemplateFn = deps.updateTemplateFn ?? updateTemplate;
  const updateTaskFieldsFn = deps.updateTaskFieldsFn ?? updateTaskFields;
  const createTemplateFn = deps.createTemplateFn ?? createTemplate;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const units = await provisionWorkUnitsForImport(
    items.map(({ item }) => item),
    (item) => ({
      workUnit: item.workUnit,
      workUnitLabel: item.workUnitLabel ?? null,
    }),
    {},
    ensureImportedWorkUnitsFn,
  );

  for (const item of items) {
    const payload = item.item;

    if (item.action === 'skip') {
      skipped += 1;
      continue;
    }

    const resolvedWorkTypeId = payload.workTypeId ?? await ensureWorkTypeExistsOrCreateFn(
      payload.workTypeTitle,
      payload.workUnit,
    );

    if (item.action === 'update' && item.existingId && item.existingType === 'template') {
      await updateTemplateFn(item.existingId, {
        title: payload.title,
        workTypeId: resolvedWorkTypeId,
        workUnit: payload.workUnit,
        phase: payload.phase,
        workQuantity: payload.workQuantity,
        estimatedMinutes: payload.estimatedMinutes,
        crew: payload.crew,
        targetProductivity: payload.targetProductivity,
      });
      updated += 1;
      continue;
    }

    if (item.action === 'update' && item.existingId && item.existingType === 'task') {
      await updateTaskFieldsFn(item.existingId, {
        title: payload.title,
        workTypeId: resolvedWorkTypeId,
        workUnit: payload.workUnit,
        phase: payload.phase,
        workQuantity: payload.workQuantity,
        estimatedMinutes: payload.estimatedMinutes,
        crew: payload.crew,
        targetProductivity: payload.targetProductivity,
      });
      updated += 1;
      continue;
    }

    await createTemplateFn({
      title: payload.title,
      workTypeId: resolvedWorkTypeId,
      workUnit: payload.workUnit,
      phase: payload.phase,
      workQuantity: payload.workQuantity,
      estimatedMinutes: payload.estimatedMinutes,
      crew: payload.crew,
      targetProductivity: payload.targetProductivity,
    });
    created += 1;
  }

  return {
    created,
    updated,
    skipped,
    unitsCreated: units.created.length,
    unitLabelsUpdated: units.relabeled.length,
  };
}

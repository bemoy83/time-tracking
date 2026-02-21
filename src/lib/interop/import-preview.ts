/**
 * Import validation preview — diffs parsed import data against existing
 * tasks and templates. Shows what would be created, updated, or skipped.
 *
 * Matches by mapping key (title::workCategory:workUnit:buildPhase).
 * Detects duplicates within the import set and conflicts with existing data.
 */

import type { Task } from '../types';
import type { TaskTemplate } from '../types';
import type { ImportedWorkPackage } from './import';
import { workPackageMappingKey } from './import';

export type ImportAction = 'create' | 'update' | 'skip';

export interface ImportPreviewItem {
  action: ImportAction;
  item: ImportedWorkPackage;
  /** Reason for skip/update (null for create). */
  reason: string | null;
  /** ID of existing entity that matches (for updates). */
  existingId: string | null;
  /** Fields that differ from existing (for updates). */
  changedFields: string[];
}

export interface ImportPreview {
  items: ImportPreviewItem[];
  summary: {
    create: number;
    update: number;
    skip: number;
  };
  /** Duplicate mapping keys found within the import set. */
  duplicateKeys: string[];
}

/** Build a mapping key for an existing task. */
function taskMappingKey(task: Task): string | null {
  if (!task.workCategory || !task.workUnit || !task.buildPhase) return null;
  return workPackageMappingKey(task.title, task.workCategory, task.workUnit, task.buildPhase);
}

/** Build a mapping key for an existing template. */
function templateMappingKey(template: TaskTemplate): string {
  return workPackageMappingKey(
    template.title,
    template.workCategory,
    template.workUnit,
    template.buildPhase,
  );
}

/** Detect fields that differ between import and existing template. */
function diffFields(imported: ImportedWorkPackage, template: TaskTemplate): string[] {
  const changed: string[] = [];
  if (imported.workQuantity !== template.workQuantity) changed.push('workQuantity');
  if (imported.estimatedMinutes !== template.estimatedMinutes) changed.push('estimatedMinutes');
  if (imported.defaultWorkers !== template.defaultWorkers) changed.push('defaultWorkers');
  if (imported.targetProductivity !== template.targetProductivity) changed.push('targetProductivity');
  return changed;
}

/** Detect fields that differ between import and existing task. */
function diffTaskFields(imported: ImportedWorkPackage, task: Task): string[] {
  const changed: string[] = [];
  if (imported.workQuantity !== task.workQuantity) changed.push('workQuantity');
  if (imported.estimatedMinutes !== task.estimatedMinutes) changed.push('estimatedMinutes');
  if (imported.defaultWorkers !== task.defaultWorkers) changed.push('defaultWorkers');
  if (imported.targetProductivity !== task.targetProductivity) changed.push('targetProductivity');
  return changed;
}

/**
 * Generate an import preview by comparing parsed items against
 * existing tasks and templates.
 *
 * Match priority: templates first, then tasks.
 * - Exact match with no changed fields → skip
 * - Exact match with changed fields → update
 * - No match → create
 */
export function generateImportPreview(
  items: ImportedWorkPackage[],
  existingTasks: Task[],
  existingTemplates: TaskTemplate[],
): ImportPreview {
  // Build lookup maps by mapping key
  const templatesByKey = new Map<string, TaskTemplate>();
  for (const t of existingTemplates) {
    templatesByKey.set(templateMappingKey(t), t);
  }

  const tasksByKey = new Map<string, Task>();
  for (const t of existingTasks) {
    const key = taskMappingKey(t);
    if (key) tasksByKey.set(key, t);
  }

  // Detect duplicates within import set
  const keyCounts = new Map<string, number>();
  for (const item of items) {
    keyCounts.set(item.mappingKey, (keyCounts.get(item.mappingKey) ?? 0) + 1);
  }
  const duplicateKeys = Array.from(keyCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const previewItems: ImportPreviewItem[] = [];

  for (const item of items) {
    // Check templates first
    const existingTemplate = templatesByKey.get(item.mappingKey);
    if (existingTemplate) {
      const changed = diffFields(item, existingTemplate);
      if (changed.length === 0) {
        previewItems.push({
          action: 'skip',
          item,
          reason: 'Identical template already exists',
          existingId: existingTemplate.id,
          changedFields: [],
        });
      } else {
        previewItems.push({
          action: 'update',
          item,
          reason: `Template differs: ${changed.join(', ')}`,
          existingId: existingTemplate.id,
          changedFields: changed,
        });
      }
      continue;
    }

    // Check tasks
    const existingTask = tasksByKey.get(item.mappingKey);
    if (existingTask) {
      const changed = diffTaskFields(item, existingTask);
      if (changed.length === 0) {
        previewItems.push({
          action: 'skip',
          item,
          reason: 'Identical task already exists',
          existingId: existingTask.id,
          changedFields: [],
        });
      } else {
        previewItems.push({
          action: 'update',
          item,
          reason: `Task differs: ${changed.join(', ')}`,
          existingId: existingTask.id,
          changedFields: changed,
        });
      }
      continue;
    }

    // No match → create
    previewItems.push({
      action: 'create',
      item,
      reason: null,
      existingId: null,
      changedFields: [],
    });
  }

  return {
    items: previewItems,
    summary: {
      create: previewItems.filter((i) => i.action === 'create').length,
      update: previewItems.filter((i) => i.action === 'update').length,
      skip: previewItems.filter((i) => i.action === 'skip').length,
    },
    duplicateKeys,
  };
}

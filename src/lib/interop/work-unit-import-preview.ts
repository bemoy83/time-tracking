import type { WorkUnit, WorkUnitDefinition } from '../types';

export interface ImportedWorkUnitReference {
  id: WorkUnit;
  label?: string | null;
}

export interface WorkUnitLabelConflict {
  id: WorkUnit;
  catalogLabel: string;
  importLabel: string;
}

export interface WorkUnitImportPreview {
  newUnits: ImportedWorkUnitReference[];
  labelConflicts: WorkUnitLabelConflict[];
}

export function collectImportedWorkUnitReferences(
  items: ImportedWorkUnitReference[],
): ImportedWorkUnitReference[] {
  const byId = new Map<WorkUnit, ImportedWorkUnitReference>();
  for (const item of items) {
    const existing = byId.get(item.id);
    const label = item.label?.trim() || null;
    if (!existing) {
      byId.set(item.id, { id: item.id, label });
      continue;
    }
    if (!existing.label && label) {
      byId.set(item.id, { id: item.id, label });
    }
  }
  return Array.from(byId.values());
}

export function buildWorkUnitImportPreview(
  items: ImportedWorkUnitReference[],
  definitions: WorkUnitDefinition[],
): WorkUnitImportPreview {
  const uniqueItems = collectImportedWorkUnitReferences(items);
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

  const newUnits: ImportedWorkUnitReference[] = [];
  const labelConflicts: WorkUnitLabelConflict[] = [];

  for (const item of uniqueItems) {
    const existing = definitionById.get(item.id);
    const importLabel = item.label?.trim() || item.id;

    if (!existing) {
      newUnits.push({ id: item.id, label: importLabel });
      continue;
    }

    if (importLabel && importLabel !== existing.label) {
      labelConflicts.push({
        id: item.id,
        catalogLabel: existing.label,
        importLabel,
      });
    }
  }

  return { newUnits, labelConflicts };
}

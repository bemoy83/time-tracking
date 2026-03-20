import {
  buildSeededWorkUnitDefinitions,
  generateWorkUnitIdFromLabel,
  isBuiltInWorkUnit,
  normalizeWorkUnitId,
  type WorkUnit,
  type WorkUnitDefinition,
} from './work-units';

export interface WorkUnitUsageSummary {
  tasks: number;
  templates: number;
  workTypes: number;
  planLineItems: number;
  total: number;
}

export interface EnsureImportedWorkUnitInput {
  id: WorkUnit;
  label?: string | null;
}

export interface EnsureImportedWorkUnitsOptions {
  applyLabelToExisting?: boolean;
}

export interface EnsureImportedWorkUnitsResult {
  created: WorkUnitDefinition[];
  relabeled: WorkUnitDefinition[];
}

export interface PlannedImportedWorkUnitsResult extends EnsureImportedWorkUnitsResult {
  definitions: WorkUnitDefinition[];
}

export function sortWorkUnitDefinitions(definitions: WorkUnitDefinition[]): WorkUnitDefinition[] {
  return [...definitions].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.label.localeCompare(b.label);
  });
}

export function reconcileSeededWorkUnitDefinitions(
  definitions: WorkUnitDefinition[],
  now: string,
): { definitions: WorkUnitDefinition[]; writes: WorkUnitDefinition[] } {
  const seeds = buildSeededWorkUnitDefinitions(now);
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const writes: WorkUnitDefinition[] = [];

  for (const [index, seed] of seeds.entries()) {
    const existing = definitionById.get(seed.id);
    if (!existing) {
      writes.push({
        ...seed,
        sortIndex: index,
      });
      continue;
    }

    const next: WorkUnitDefinition = {
      ...existing,
      builtIn: true,
      archivedAt: null,
      sortIndex: Number.isFinite(existing.sortIndex) ? existing.sortIndex : index,
      label: existing.label?.trim() ? existing.label : seed.label,
      createdAt: existing.createdAt || seed.createdAt,
      updatedAt: existing.updatedAt || seed.updatedAt,
    };

    if (JSON.stringify(next) !== JSON.stringify(existing)) {
      writes.push(next);
    }
  }

  const merged = new Map(definitions.map((definition) => [definition.id, definition]));
  for (const definition of writes) {
    merged.set(definition.id, definition);
  }

  return {
    definitions: sortWorkUnitDefinitions(Array.from(merged.values())),
    writes,
  };
}

export function buildCreatedWorkUnitDefinition(
  label: string,
  definitions: WorkUnitDefinition[],
  now: string,
): WorkUnitDefinition {
  const trimmedLabel = label.trim();
  const id = generateWorkUnitIdFromLabel(
    trimmedLabel,
    definitions.map((definition) => definition.id),
  );

  return {
    id,
    label: trimmedLabel,
    sortIndex: definitions.length,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    builtIn: false,
  };
}

export function buildRelabeledWorkUnitDefinition(
  definition: WorkUnitDefinition,
  label: string,
  now: string,
): WorkUnitDefinition {
  return {
    ...definition,
    label: label.trim(),
    updatedAt: now,
  };
}

export function reorderDefinitions(
  definitions: WorkUnitDefinition[],
  nextIdsInOrder: string[],
  now: string,
): WorkUnitDefinition[] {
  const current = sortWorkUnitDefinitions(definitions);
  const requestedIds = new Set(nextIdsInOrder);
  const ordered = [
    ...nextIdsInOrder
      .map((id) => current.find((definition) => definition.id === id))
      .filter((definition): definition is WorkUnitDefinition => definition != null),
    ...current.filter((definition) => !requestedIds.has(definition.id)),
  ];

  return ordered.map((definition, index) => ({
    ...definition,
    sortIndex: index,
    updatedAt: definition.sortIndex === index ? definition.updatedAt : now,
  }));
}

export function buildArchivedWorkUnitDefinition(
  definition: WorkUnitDefinition,
  now: string,
): WorkUnitDefinition {
  return {
    ...definition,
    archivedAt: now,
    updatedAt: now,
  };
}

export function buildUnarchivedWorkUnitDefinition(
  definition: WorkUnitDefinition,
  now: string,
): WorkUnitDefinition {
  return {
    ...definition,
    archivedAt: null,
    updatedAt: now,
  };
}

export function planImportedWorkUnits(
  definitions: WorkUnitDefinition[],
  items: EnsureImportedWorkUnitInput[],
  options: EnsureImportedWorkUnitsOptions,
  now: string,
): PlannedImportedWorkUnitsResult {
  const applyLabelToExisting = options.applyLabelToExisting === true;
  const created: WorkUnitDefinition[] = [];
  const relabeled: WorkUnitDefinition[] = [];
  const nextDefinitions = [...definitions];
  const definitionById = new Map(nextDefinitions.map((definition) => [definition.id, definition]));

  for (const item of items) {
    const id = normalizeWorkUnitId(item.id);
    const importLabel = item.label?.trim() || id;
    const existing = definitionById.get(id);

    if (!existing) {
      const definition: WorkUnitDefinition = {
        id,
        label: importLabel,
        sortIndex: nextDefinitions.length,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        builtIn: isBuiltInWorkUnit(id),
      };
      nextDefinitions.push(definition);
      definitionById.set(id, definition);
      created.push(definition);
      continue;
    }

    if (applyLabelToExisting && importLabel && importLabel !== existing.label) {
      const updated = buildRelabeledWorkUnitDefinition(existing, importLabel, now);
      const index = nextDefinitions.findIndex((definition) => definition.id === id);
      nextDefinitions[index] = updated;
      definitionById.set(id, updated);
      relabeled.push(updated);
    }
  }

  return {
    definitions: sortWorkUnitDefinitions(nextDefinitions),
    created,
    relabeled,
  };
}

export function getSelectableWorkUnitDefinitionsFromList(
  definitions: WorkUnitDefinition[],
  currentUnitId: string | null | undefined = null,
): WorkUnitDefinition[] {
  return definitions.filter((definition) =>
    definition.archivedAt == null || definition.id === currentUnitId,
  );
}

export function getDefaultWorkUnitIdFromDefinitions(
  definitions: WorkUnitDefinition[],
): WorkUnit {
  return getSelectableWorkUnitDefinitionsFromList(definitions)[0]?.id ?? 'm2';
}

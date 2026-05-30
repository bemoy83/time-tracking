import { useSyncExternalStore } from 'react';
import {
  buildSeededWorkUnitDefinitions,
  nowUtc,
  resolveWorkUnitLabel,
  syncWorkUnitLabelRegistry,
  type WorkUnitDefinition,
} from '../types';
import type { WorkUnit } from '../types';
import {
  buildArchivedWorkUnitDefinition,
  buildCreatedWorkUnitDefinition,
  buildRelabeledWorkUnitDefinition,
  buildUnarchivedWorkUnitDefinition,
  getDefaultWorkUnitIdFromDefinitions,
  getSelectableWorkUnitDefinitionsFromList,
  reorderDefinitions,
  type EnsureImportedWorkUnitInput,
  type EnsureImportedWorkUnitsOptions,
  type EnsureImportedWorkUnitsResult,
  type WorkUnitUsageSummary,
} from '../work-unit-domain';
import {
  createWorkUnitDefinitions,
  ensureImportedWorkUnitsPersisted,
  getWorkUnitUsageSummary as getWorkUnitUsageSummaryFromService,
  isNonArchivableWorkUnitDefinition,
  loadSeededWorkUnitDefinitions,
  persistWorkUnitDefinition,
  persistWorkUnitDefinitions,
  removeWorkUnitDefinition,
} from '../work-unit-service';

type WorkUnitStoreState = {
  definitions: WorkUnitDefinition[];
  isLoading: boolean;
  error: string | null;
};

let state: WorkUnitStoreState = {
  definitions: [],
  isLoading: true,
  error: null,
};

const listeners = new Set<() => void>();
let initialized = false;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setState(partial: Partial<WorkUnitStoreState>) {
  state = {
    ...state,
    ...partial,
  };
  state.definitions = [...state.definitions].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.label.localeCompare(b.label);
  });
  syncWorkUnitLabelRegistry(state.definitions);
  notifyListeners();
}

export async function initializeWorkUnitStore(): Promise<void> {
  if (initialized) return;

  try {
    const seeded = await loadSeededWorkUnitDefinitions();
    setState({
      definitions: seeded,
      isLoading: false,
      error: null,
    });
    initialized = true;
  } catch (error) {
    setState({
      definitions: buildSeededWorkUnitDefinitions(nowUtc()),
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to load work units',
    });
  }
}

export async function refreshWorkUnitStore(): Promise<void> {
  const seeded = await loadSeededWorkUnitDefinitions();
  setState({
    definitions: seeded,
    isLoading: false,
    error: null,
  });
  initialized = true;
}

export function resetWorkUnitState(): void {
  initialized = false;
  setState({
    definitions: buildSeededWorkUnitDefinitions(nowUtc()),
    isLoading: false,
    error: null,
  });
}

export function getWorkUnitDefinitionById(id: string | null | undefined): WorkUnitDefinition | undefined {
  if (!id) return undefined;
  return state.definitions.find((definition) => definition.id === id);
}

export function getSelectableWorkUnitDefinitions(
  currentUnitId: string | null | undefined = null,
): WorkUnitDefinition[] {
  return getSelectableWorkUnitDefinitionsFromList(state.definitions, currentUnitId);
}

export function getDefaultWorkUnitId(): WorkUnit {
  return getDefaultWorkUnitIdFromDefinitions(state.definitions);
}

export async function createWorkUnitDefinition(label: string): Promise<WorkUnitDefinition> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error('Label is required.');
  }

  const next = buildCreatedWorkUnitDefinition(trimmedLabel, state.definitions, nowUtc());
  await createWorkUnitDefinitions([next]);
  setState({ definitions: [...state.definitions, next] });
  return next;
}

export async function updateWorkUnitDefinitionLabel(
  id: string,
  label: string,
): Promise<WorkUnitDefinition> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const definition = getWorkUnitDefinitionById(id);
  if (!definition) {
    throw new Error(`Work unit "${id}" not found.`);
  }

  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error('Label is required.');
  }

  const updated = buildRelabeledWorkUnitDefinition(definition, trimmedLabel, nowUtc());

  await persistWorkUnitDefinition(updated);
  setState({
    definitions: state.definitions.map((item) => (item.id === id ? updated : item)),
  });
  return updated;
}

export async function reorderWorkUnitDefinitions(nextIdsInOrder: string[]): Promise<void> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const next = reorderDefinitions(state.definitions, nextIdsInOrder, nowUtc());
  await persistWorkUnitDefinitions(next);
  setState({ definitions: next });
}

export async function getWorkUnitUsageSummary(id: string): Promise<WorkUnitUsageSummary> {
  return getWorkUnitUsageSummaryFromService(id);
}

export async function archiveWorkUnitDefinition(id: string): Promise<void> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const definition = getWorkUnitDefinitionById(id);
  if (!definition) {
    throw new Error(`Work unit "${id}" not found.`);
  }
  if (isNonArchivableWorkUnitDefinition(definition)) {
    throw new Error('Built-in units cannot be archived.');
  }
  if (definition.archivedAt != null) {
    return;
  }

  const updated = buildArchivedWorkUnitDefinition(definition, nowUtc());
  await persistWorkUnitDefinition(updated);
  setState({
    definitions: state.definitions.map((item) => (item.id === id ? updated : item)),
  });
}

export async function unarchiveWorkUnitDefinition(id: string): Promise<void> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const definition = getWorkUnitDefinitionById(id);
  if (!definition) {
    throw new Error(`Work unit "${id}" not found.`);
  }

  const updated = buildUnarchivedWorkUnitDefinition(definition, nowUtc());
  await persistWorkUnitDefinition(updated);
  setState({
    definitions: state.definitions.map((item) => (item.id === id ? updated : item)),
  });
}

export async function deleteWorkUnitDefinitionById(id: string): Promise<void> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const definition = getWorkUnitDefinitionById(id);
  if (!definition) return;
  if (isNonArchivableWorkUnitDefinition(definition)) {
    throw new Error('Built-in units cannot be deleted.');
  }

  const usage = await getWorkUnitUsageSummary(id);
  if (usage.total > 0) {
    throw new Error(
      `Unit "${resolveWorkUnitLabel(id)}" is still in use (${usage.workTypes} work types, ${usage.tasks} tasks, ${usage.templates} templates, ${usage.planLineItems} plan items). Archive it instead.`,
    );
  }

  await removeWorkUnitDefinition(id);
  setState({
    definitions: state.definitions.filter((definition) => definition.id !== id),
  });
}

export async function ensureImportedWorkUnits(
  items: EnsureImportedWorkUnitInput[],
  options: EnsureImportedWorkUnitsOptions = {},
): Promise<EnsureImportedWorkUnitsResult> {
  if (!initialized) {
    await initializeWorkUnitStore();
  }
  const result = await ensureImportedWorkUnitsPersisted(state.definitions, items, options);
  if (result.created.length > 0 || result.relabeled.length > 0) {
    setState({ definitions: result.definitions });
  }
  return {
    created: result.created,
    relabeled: result.relabeled,
  };
}

export async function reseedBuiltInWorkUnits(): Promise<void> {
  const seeded = await loadSeededWorkUnitDefinitions();
  setState({ definitions: seeded });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): WorkUnitStoreState {
  return state;
}

export function useWorkUnitStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

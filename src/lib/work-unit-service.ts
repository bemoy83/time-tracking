import {
  addWorkUnitDefinitions,
  deleteWorkUnitDefinition,
  getAllPlans,
  getAllTaskTemplates,
  getAllTasks,
  getAllWorkTypes,
  getAllWorkUnitDefinitions,
  updateWorkUnitDefinition,
  updateWorkUnitDefinitions,
} from './db';
import { isBuiltInWorkUnit, isValidWorkUnitId, normalizeWorkUnitId, type WorkUnitDefinition } from './work-units';
import { nowUtc } from './types';
import {
  planImportedWorkUnits,
  reconcileSeededWorkUnitDefinitions,
  type EnsureImportedWorkUnitInput,
  type EnsureImportedWorkUnitsOptions,
  type PlannedImportedWorkUnitsResult,
  type WorkUnitUsageSummary,
} from './work-unit-domain';

export async function loadSeededWorkUnitDefinitions(): Promise<WorkUnitDefinition[]> {
  const { definitions, writes } = reconcileSeededWorkUnitDefinitions(
    await getAllWorkUnitDefinitions(),
    nowUtc(),
  );
  if (writes.length > 0) {
    await addWorkUnitDefinitions(writes);
  }
  return definitions;
}

export async function persistWorkUnitDefinition(definition: WorkUnitDefinition): Promise<void> {
  await updateWorkUnitDefinition(definition);
}

export async function persistWorkUnitDefinitions(definitions: WorkUnitDefinition[]): Promise<void> {
  await updateWorkUnitDefinitions(definitions);
}

export async function createWorkUnitDefinitions(definitions: WorkUnitDefinition[]): Promise<void> {
  await addWorkUnitDefinitions(definitions);
}

export async function removeWorkUnitDefinition(id: string): Promise<void> {
  await deleteWorkUnitDefinition(id);
}

export async function getWorkUnitUsageSummary(id: string): Promise<WorkUnitUsageSummary> {
  const [tasks, templates, workTypes, plans] = await Promise.all([
    getAllTasks(),
    getAllTaskTemplates(),
    getAllWorkTypes(),
    getAllPlans(),
  ]);

  const summary = {
    tasks: tasks.filter((task) => task.workUnit === id).length,
    templates: templates.filter((template) => template.workUnit === id).length,
    workTypes: workTypes.filter((workType) => workType.workUnit === id).length,
    planLineItems: plans.reduce(
      (total, plan) => total + plan.lineItems.filter((item) => item.workUnit === id).length,
      0,
    ),
    total: 0,
  };

  summary.total =
    summary.tasks +
    summary.templates +
    summary.workTypes +
    summary.planLineItems;

  return summary;
}

export async function ensureImportedWorkUnitsPersisted(
  definitions: WorkUnitDefinition[],
  items: EnsureImportedWorkUnitInput[],
  options: EnsureImportedWorkUnitsOptions = {},
): Promise<PlannedImportedWorkUnitsResult> {
  const normalizedItems = items.map((item) => {
    const id = normalizeWorkUnitId(item.id);
    if (!isValidWorkUnitId(id)) {
      throw new Error(`Invalid work unit id: "${item.id}".`);
    }

    return {
      id,
      label: item.label,
    };
  });

  const result = planImportedWorkUnits(definitions, normalizedItems, options, nowUtc());
  const writes = [
    ...result.created,
    ...result.relabeled,
  ];

  if (writes.length > 0) {
    await addWorkUnitDefinitions(writes);
  }

  return result;
}

export function isNonArchivableWorkUnitDefinition(definition: WorkUnitDefinition): boolean {
  return definition.builtIn || isBuiltInWorkUnit(definition.id);
}

/**
 * Work Type store with React state management.
 * Provides CRUD operations for WorkType entities.
 */

import {
  getAllWorkTypes,
  addWorkType as dbAddWorkType,
  updateWorkType as dbUpdateWorkType,
  deleteWorkType as dbDeleteWorkType,
} from '../db';
import type { WorkType, WorkUnit } from '../types';
import { generateId, nowUtc, normalizeWorkTypeTitle } from '../types';
import { useSyncExternalStore } from 'react';

// ============================================================
// Store State
// ============================================================

type WorkTypeStoreState = {
  workTypes: WorkType[];
  isLoading: boolean;
};

let state: WorkTypeStoreState = {
  workTypes: [],
  isLoading: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setState(partial: Partial<WorkTypeStoreState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Store Initialization
// ============================================================

let initialized = false;

export async function initializeWorkTypeStore(): Promise<void> {
  if (initialized) return;

  try {
    const workTypes = await getAllWorkTypes();
    setState({ workTypes, isLoading: false });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

// ============================================================
// Work Type Actions
// ============================================================

export interface CreateWorkTypeInput {
  title: string;
  workUnit: WorkUnit;
  buildUpRate: number;
  tearDownRate: number;
  readOnly?: boolean;
  importedForPlanId?: string | null;
}

/**
 * Create a new WorkType. Enforces (title, workUnit) uniqueness.
 * Throws if duplicate exists.
 */
export async function createWorkType(input: CreateWorkTypeInput): Promise<WorkType> {
  const normalizedTitle = normalizeWorkTypeTitle(input.title);
  const importedPlanId = input.importedForPlanId ?? null;
  const isReadOnlyImport = input.readOnly === true;

  const existing = state.workTypes.find((wt) => {
    const sameKey =
      normalizeWorkTypeTitle(wt.title) === normalizedTitle &&
      wt.workUnit === input.workUnit;
    if (!sameKey) return false;

    if (!isReadOnlyImport) {
      return wt.readOnly !== true;
    }

    if (wt.readOnly === true) {
      return (wt.importedForPlanId ?? null) === importedPlanId;
    }
    return true;
  });

  if (existing) {
    throw new Error(`Work type "${input.title}" with unit ${input.workUnit} already exists`);
  }

  const now = nowUtc();
  const workType: WorkType = {
    id: generateId(),
    title: input.title.trim(),
    workUnit: input.workUnit,
    buildUpRate: input.buildUpRate,
    tearDownRate: input.tearDownRate,
    readOnly: input.readOnly ?? false,
    importedForPlanId: input.importedForPlanId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddWorkType(workType);
  setState({ workTypes: [...state.workTypes, workType] });
  return workType;
}

export async function updateWorkTypeFields(
  id: string,
  updates: Partial<Omit<WorkType, 'id' | 'createdAt'>>,
): Promise<void> {
  const workType = state.workTypes.find((wt) => wt.id === id);
  if (!workType) return;
  if (workType.readOnly) {
    throw new Error('Imported read-only work types cannot be edited');
  }

  // If title/unit are changing, check uniqueness
  const newTitle = updates.title ?? workType.title;
  const newUnit = updates.workUnit ?? workType.workUnit;

  const duplicate = state.workTypes.find((wt) => {
    if (wt.id === id) return false;
    if (wt.readOnly) return false;
    return (
      normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(newTitle) &&
      wt.workUnit === newUnit
    );
  });
  if (duplicate) {
    throw new Error(`Work type "${newTitle}" with unit ${newUnit} already exists`);
  }

  const updated: WorkType = { ...workType, ...updates, id, createdAt: workType.createdAt, updatedAt: nowUtc() };
  await dbUpdateWorkType(updated);
  setState({
    workTypes: state.workTypes.map((wt) => (wt.id === id ? updated : wt)),
  });
}

export async function removeWorkType(id: string): Promise<void> {
  await dbDeleteWorkType(id);
  setState({
    workTypes: state.workTypes.filter((wt) => wt.id !== id),
  });
}

export function resetWorkTypeState(): void {
  setState({ workTypes: [] });
}

// ============================================================
// Selectors
// ============================================================

export function getWorkTypeById(id: string): WorkType | undefined {
  return state.workTypes.find((wt) => wt.id === id);
}

export function findWorkTypeByCompositeKey(
  title: string,
  workUnit: WorkUnit,
): WorkType | undefined {
  const matches = state.workTypes.filter(
    (wt) =>
      normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(title) &&
      wt.workUnit === workUnit,
  );

  const editable = matches.find((wt) => wt.readOnly !== true);
  if (editable) return editable;

  return matches[0];
}

export function findWorkTypeByKey(
  title: string,
  workUnit: WorkUnit,
): WorkType | undefined {
  return findWorkTypeByCompositeKey(title, workUnit);
}

export async function ensureWorkTypeExistsOrCreate(
  title: string,
  workUnit: WorkUnit,
  defaultBuildUpRate: number = 0,
  defaultTearDownRate: number = 0,
): Promise<string> {
  const existing = findWorkTypeByKey(title, workUnit);
  if (existing) return existing.id;

  const created = await createWorkType({
    title,
    workUnit,
    buildUpRate: defaultBuildUpRate,
    tearDownRate: defaultTearDownRate,
  });
  return created.id;
}

// ============================================================
// React Integration
// ============================================================

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): WorkTypeStoreState {
  return state;
}

export function useWorkTypeStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

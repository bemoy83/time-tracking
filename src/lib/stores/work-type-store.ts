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
import type { WorkType, WorkUnit, BuildPhase } from '../types';
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
  buildPhase: BuildPhase;
  expectedProductivity: number;
}

/**
 * Create a new WorkType. Enforces (title, workUnit, buildPhase) uniqueness.
 * Throws if duplicate exists.
 */
export async function createWorkType(input: CreateWorkTypeInput): Promise<WorkType> {
  // Check uniqueness in local state first
  const existing = state.workTypes.find(
    (wt) =>
      normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(input.title) &&
      wt.workUnit === input.workUnit &&
      wt.buildPhase === input.buildPhase,
  );
  if (existing) {
    throw new Error(`Work type "${input.title}" with unit ${input.workUnit} and phase ${input.buildPhase} already exists`);
  }

  const now = nowUtc();
  const workType: WorkType = {
    id: generateId(),
    title: input.title.trim(),
    workUnit: input.workUnit,
    buildPhase: input.buildPhase,
    expectedProductivity: input.expectedProductivity,
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

  // If title/unit/phase are changing, check uniqueness
  const newTitle = updates.title ?? workType.title;
  const newUnit = updates.workUnit ?? workType.workUnit;
  const newPhase = updates.buildPhase ?? workType.buildPhase;

  const duplicate = state.workTypes.find(
    (wt) =>
      wt.id !== id &&
      normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(newTitle) &&
      wt.workUnit === newUnit &&
      wt.buildPhase === newPhase,
  );
  if (duplicate) {
    throw new Error(`Work type "${newTitle}" with unit ${newUnit} and phase ${newPhase} already exists`);
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

// ============================================================
// Selectors
// ============================================================

export function getWorkTypeById(id: string): WorkType | undefined {
  return state.workTypes.find((wt) => wt.id === id);
}

export function findWorkTypeByCompositeKey(
  title: string,
  workUnit: WorkUnit,
  buildPhase: BuildPhase,
): WorkType | undefined {
  return state.workTypes.find(
    (wt) =>
      normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(title) &&
      wt.workUnit === workUnit &&
      wt.buildPhase === buildPhase,
  );
}

export function findWorkTypeByKey(
  title: string,
  workUnit: WorkUnit,
  buildPhase: BuildPhase,
): WorkType | undefined {
  return findWorkTypeByCompositeKey(title, workUnit, buildPhase);
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

/**
 * Crew Pool Store — manages system-level crew headcounts per skill tag.
 *
 * Follows the same useSyncExternalStore pattern used throughout the app.
 *
 * The store holds `allocations: Record<string, number>` — a map from skill
 * tag ID to crew headcount. This is a system-level singleton: it applies
 * to all plans and the shared scheduler unless overridden by a specific
 * WorkCalendarDay's `crewComposition` field.
 */

import { useSyncExternalStore } from 'react';
import { getCrewPool, putCrewPool } from '../db';
import { nowUtc } from '../types';

// ============================================================
// Store State
// ============================================================

type CrewPoolState = {
  defaultCrewSize: number | null;
  taskSwitchingFactor: number | null;
  allocations: Record<string, number>;
  dailyDeployments: Record<string, number>;
  isLoading: boolean;
};

let state: CrewPoolState = {
  defaultCrewSize: null,
  taskSwitchingFactor: null,
  allocations: {},
  dailyDeployments: {},
  isLoading: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<CrewPoolState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Initialization
// ============================================================

let initialized = false;

export async function initializeCrewPoolStore(): Promise<void> {
  if (initialized) return;
  try {
    const pool = await getCrewPool();
    const allocations = pool?.allocations ?? {};
    // Clamp any daily deployments that exceed the corresponding worker count.
    const rawDeployments = pool?.dailyDeployments ?? {};
    const dailyDeployments: Record<string, number> = {};
    for (const [id, cap] of Object.entries(rawDeployments)) {
      const workers = allocations[id];
      if (workers != null && cap > workers) {
        dailyDeployments[id] = workers;
      } else {
        dailyDeployments[id] = cap;
      }
    }
    setState({
      defaultCrewSize: pool?.defaultCrewSize ?? null,
      taskSwitchingFactor: pool?.taskSwitchingFactor ?? null,
      allocations,
      dailyDeployments,
      isLoading: false,
    });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

export function resetCrewPoolStoreState(): void {
  initialized = false;
  setState({ defaultCrewSize: null, taskSwitchingFactor: null, allocations: {}, dailyDeployments: {}, isLoading: true });
}

// ============================================================
// Actions
// ============================================================

/**
 * Set or update the crew headcount for a single skill tag.
 * A count of 0 removes the tag from the active allocations.
 */
export async function setSkillCrewCount(tagId: string, count: number): Promise<void> {
  const nextAllocations = { ...state.allocations };
  const nextDeployments = { ...state.dailyDeployments };
  if (count <= 0) {
    delete nextAllocations[tagId];
    delete nextDeployments[tagId];
  } else {
    nextAllocations[tagId] = count;
    // Auto-clamp daily cap to new workers count.
    const existingCap = nextDeployments[tagId];
    if (existingCap != null && existingCap > count) {
      nextDeployments[tagId] = count;
    }
  }
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    taskSwitchingFactor: state.taskSwitchingFactor,
    allocations: nextAllocations,
    dailyDeployments: nextDeployments,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ allocations: nextAllocations, dailyDeployments: nextDeployments });
}

/**
 * Set the system-level default crew size — the fallback used for work types
 * with no skill tag constraint. Pass null to clear.
 */
export async function setSystemDefaultCrewSize(count: number | null): Promise<void> {
  const pool = {
    id: 'global' as const,
    defaultCrewSize: count,
    taskSwitchingFactor: state.taskSwitchingFactor,
    allocations: state.allocations,
    dailyDeployments: state.dailyDeployments,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ defaultCrewSize: count });
}

/**
 * Set the task-switching (fragmentation) factor.
 * Exponential decay base applied per additional skill group beyond the first on any day.
 * Range 0.80–1.00. Pass null to use the default of 0.95.
 */
export async function setTaskSwitchingFactor(factor: number | null): Promise<void> {
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    taskSwitchingFactor: factor,
    allocations: state.allocations,
    dailyDeployments: state.dailyDeployments,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ taskSwitchingFactor: factor });
}

/**
 * Remove a skill tag entry from the crew pool entirely.
 * Called automatically when a skill tag is deleted.
 */
export async function removeSkillCrewEntry(tagId: string): Promise<void> {
  if (!(tagId in state.allocations) && !(tagId in (state.dailyDeployments ?? {}))) return;
  const nextAllocations = { ...state.allocations };
  delete nextAllocations[tagId];
  const nextDeployments = { ...(state.dailyDeployments ?? {}) };
  delete nextDeployments[tagId];
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    taskSwitchingFactor: state.taskSwitchingFactor,
    allocations: nextAllocations,
    dailyDeployments: nextDeployments,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ allocations: nextAllocations, dailyDeployments: nextDeployments });
}

/**
 * Set the daily deployment cap for a single skill tag.
 * Must be ≤ the corresponding headcount in allocations.
 * A count of 0 removes the cap (reverts to full headcount).
 */
export async function setSkillDailyDeployment(tagId: string, count: number): Promise<void> {
  const next = { ...(state.dailyDeployments ?? {}) };
  if (count <= 0) {
    delete next[tagId];
  } else {
    next[tagId] = count;
  }
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    taskSwitchingFactor: state.taskSwitchingFactor,
    allocations: state.allocations,
    dailyDeployments: next,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ dailyDeployments: next });
}

// ============================================================
// React Integration
// ============================================================

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CrewPoolState {
  return state;
}

export function useCrewPoolStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

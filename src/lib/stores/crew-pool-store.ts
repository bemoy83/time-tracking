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
  allocations: Record<string, number>;
  isLoading: boolean;
};

let state: CrewPoolState = {
  defaultCrewSize: null,
  allocations: {},
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
    setState({
      defaultCrewSize: pool?.defaultCrewSize ?? null,
      allocations: pool?.allocations ?? {},
      isLoading: false,
    });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

export function resetCrewPoolStoreState(): void {
  initialized = false;
  setState({ defaultCrewSize: null, allocations: {}, isLoading: true });
}

// ============================================================
// Actions
// ============================================================

/**
 * Set or update the crew headcount for a single skill tag.
 * A count of 0 removes the tag from the active allocations.
 */
export async function setSkillCrewCount(tagId: string, count: number): Promise<void> {
  const next = { ...state.allocations };
  if (count <= 0) {
    delete next[tagId];
  } else {
    next[tagId] = count;
  }
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    allocations: next,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ allocations: next });
}

/**
 * Set the system-level default crew size — the fallback used for work types
 * with no skill tag constraint. Pass null to clear.
 */
export async function setSystemDefaultCrewSize(count: number | null): Promise<void> {
  const pool = {
    id: 'global' as const,
    defaultCrewSize: count,
    allocations: state.allocations,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ defaultCrewSize: count });
}

/**
 * Remove a skill tag entry from the crew pool entirely.
 * Called automatically when a skill tag is deleted.
 */
export async function removeSkillCrewEntry(tagId: string): Promise<void> {
  if (!(tagId in state.allocations)) return;
  const next = { ...state.allocations };
  delete next[tagId];
  const pool = {
    id: 'global' as const,
    defaultCrewSize: state.defaultCrewSize,
    allocations: next,
    updatedAt: nowUtc(),
  };
  await putCrewPool(pool);
  setState({ allocations: next });
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

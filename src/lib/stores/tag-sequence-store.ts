/**
 * Tag Sequence Store — manages the user-defined execution order for
 * sequencable tags.
 *
 * Follows the same useSyncExternalStore pattern used throughout the app.
 *
 * The store holds `tagIds: string[]` — an explicit ordered list of tag IDs.
 * The SettingsTagSequenceView derives the display list from:
 *   tags.filter(t => t.sequencable), sorted by position in tagIds.
 * Tags not in `tagIds` (newly marked sequencable) appear at the end.
 */

import { useSyncExternalStore } from 'react';
import { getGlobalTagSequence, putGlobalTagSequence } from '../db';
import { nowUtc } from '../types';

// ============================================================
// Store State
// ============================================================

type TagSequenceState = {
  tagIds: string[];
  isLoading: boolean;
};

let state: TagSequenceState = {
  tagIds: [],
  isLoading: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<TagSequenceState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Initialization
// ============================================================

let initialized = false;

export async function initializeTagSequenceStore(): Promise<void> {
  if (initialized) return;
  try {
    const seq = await getGlobalTagSequence();
    setState({ tagIds: seq?.tagIds ?? [], isLoading: false });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

export function resetTagSequenceStoreState(): void {
  initialized = false;
  setState({ tagIds: [], isLoading: true });
}

// ============================================================
// Actions
// ============================================================

/**
 * Persist a new ordering of sequencable tag IDs.
 * Pass the full ordered array; the store replaces the existing order.
 */
export async function setTagSequenceOrder(tagIds: string[]): Promise<void> {
  const seq = {
    id: 'global' as const,
    tagIds,
    updatedAt: nowUtc(),
  };
  await putGlobalTagSequence(seq);
  setState({ tagIds });
}

// ============================================================
// React Integration
// ============================================================

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TagSequenceState {
  return state;
}

export function useTagSequenceStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

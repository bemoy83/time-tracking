/**
 * Offline Sync Queue for Time Entries.
 *
 * Design requirements from CONTEXT.md:
 * - Queue time entries for later sync
 * - Sync on reconnect
 * - Conflict-safe aggregation
 * - No silent time loss
 */

import {
  getPendingTimeEntries,
  updateTimeEntrySyncStatus,
} from '../db';
import { TimeEntry } from '../types';

// ============================================================
// Sync Queue State
// ============================================================

type SyncState = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAttempt: string | null;
  lastSyncSuccess: string | null;
  lastError: string | null;
};

let state: SyncState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAttempt: null,
  lastSyncSuccess: null,
  lastError: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setState(partial: Partial<SyncState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Network Status Detection
// ============================================================

/**
 * Initialize network status listeners.
 */
export function initNetworkListeners(): void {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    setState({ isOnline: true });
    // Attempt sync when coming back online
    syncPendingEntries();
  };

  const handleOffline = () => {
    setState({ isOnline: false });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Also listen for visibility changes to sync when app becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.isOnline) {
      syncPendingEntries();
    }
  });
}

// ============================================================
// Sync Operations
// ============================================================

/**
 * Backend sync function type.
 * This will be provided when a backend is configured.
 */
type SyncFunction = (entries: TimeEntry[]) => Promise<SyncResult>;

interface SyncResult {
  success: boolean;
  syncedIds: string[];
  failedIds: string[];
  conflicts: ConflictEntry[];
}

interface ConflictEntry {
  localEntry: TimeEntry;
  serverEntry: TimeEntry;
  resolution: 'local' | 'server' | 'merge';
}

// Placeholder sync function (no backend yet)
let syncFunction: SyncFunction | null = null;

/**
 * Register a backend sync function.
 * Call this when configuring the app with a backend.
 */
export function registerSyncFunction(fn: SyncFunction): void {
  syncFunction = fn;
}

/**
 * Sync all pending time entries.
 * Safe to call multiple times - will skip if already syncing.
 */
export async function syncPendingEntries(): Promise<void> {
  // Skip if already syncing, offline, or no sync function
  if (state.isSyncing || !state.isOnline) {
    return;
  }

  setState({ isSyncing: true, lastSyncAttempt: new Date().toISOString() });

  try {
    const pendingEntries = await getPendingTimeEntries();

    if (pendingEntries.length === 0) {
      setState({
        isSyncing: false,
        pendingCount: 0,
        lastSyncSuccess: new Date().toISOString(),
        lastError: null,
      });
      return;
    }

    // If no sync function registered, just update count
    if (!syncFunction) {
      setState({
        isSyncing: false,
        pendingCount: pendingEntries.length,
      });
      return;
    }

    // Perform sync
    const result = await syncFunction(pendingEntries);

    // Update sync status for successful entries
    for (const id of result.syncedIds) {
      await updateTimeEntrySyncStatus(id, 'synced');
    }

    // Handle conflicts
    for (const conflict of result.conflicts) {
      await handleConflict(conflict);
    }

    // Update state
    const remainingPending = await getPendingTimeEntries();
    setState({
      isSyncing: false,
      pendingCount: remainingPending.length,
      lastSyncSuccess: result.success ? new Date().toISOString() : state.lastSyncSuccess,
      lastError: result.success ? null : 'Some entries failed to sync',
    });
  } catch (err) {
    setState({
      isSyncing: false,
      lastError: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

/**
 * Handle a sync conflict.
 * Default strategy: Keep local entry (user's time is sacred).
 */
async function handleConflict(conflict: ConflictEntry): Promise<void> {
  const { localEntry, resolution } = conflict;

  switch (resolution) {
    case 'local':
      // Keep local, mark as synced (server accepted our version)
      await updateTimeEntrySyncStatus(localEntry.id, 'synced');
      break;

    case 'server':
      // Accept server version - would need to update local entry
      // For now, mark as conflict for manual resolution
      await updateTimeEntrySyncStatus(localEntry.id, 'conflict');
      break;

    case 'merge':
      // Merge strategy - for time entries, we typically keep both
      // Mark local as synced, server entry would be added separately
      await updateTimeEntrySyncStatus(localEntry.id, 'synced');
      break;
  }
}

/**
 * Get count of pending (unsynced) entries.
 */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingTimeEntries();
  setState({ pendingCount: pending.length });
  return pending.length;
}

/**
 * Force retry sync for failed entries.
 */
export async function retryFailedSync(): Promise<void> {
  if (!state.isOnline) {
    setState({ lastError: 'Cannot sync while offline' });
    return;
  }

  await syncPendingEntries();
}

// ============================================================
// React Integration
// ============================================================

import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SyncState {
  return state;
}

/**
 * React hook to access sync state.
 */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================
// Initialization
// ============================================================

let initialized = false;

/**
 * Initialize the sync system.
 */
export async function initializeSyncQueue(): Promise<void> {
  if (initialized) return;

  initNetworkListeners();
  await getPendingCount();

  // Attempt initial sync if online
  if (state.isOnline) {
    syncPendingEntries();
  }

  initialized = true;
}

/**
 * Timer store with React state management.
 * Implements timer rules from CONTEXT.md:
 * - Only one active timer per user
 * - Timer start blocked on blocked tasks
 * - Timer stop always allowed
 * - Timers survive reload, backgrounding, and offline use
 * - Time calculated from timestamps only (no setInterval)
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  getActiveTimer,
  setActiveTimer,
  clearActiveTimer,
  addTimeEntry,
  getTask,
} from '../db';
import {
  ActiveTimer,
  TimeEntry,
  generateId,
  nowUtc,
  elapsedMs,
} from '../types';

// ============================================================
// Store State
// ============================================================

type TimerState = {
  activeTimer: ActiveTimer | null;
  isLoading: boolean;
  error: string | null;
};

let state: TimerState = {
  activeTimer: null,
  isLoading: true,
  error: null,
};

// Subscribers for state changes
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setState(partial: Partial<TimerState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Store Initialization
// ============================================================

let initialized = false;

/**
 * Initialize the timer store by loading persisted state from IndexedDB.
 * Called once on app startup.
 */
const LEGACY_UNASSIGNED_TASK_ID = 'unassigned';

export async function initializeTimerStore(): Promise<void> {
  if (initialized) return;

  try {
    let timer = await getActiveTimer();
    if (timer?.taskId === LEGACY_UNASSIGNED_TASK_ID) {
      await clearActiveTimer();
      timer = null;
    }
    setState({
      activeTimer: timer,
      isLoading: false,
      error: null,
    });
    initialized = true;
  } catch (err) {
    setState({
      isLoading: false,
      error: err instanceof Error ? err.message : 'Failed to load timer',
    });
  }
}

// ============================================================
// Timer Actions
// ============================================================

export type StartTimerResult =
  | { success: true }
  | { success: false; reason: 'task_blocked' | 'timer_active' | 'task_not_found' | 'error'; message: string };

/**
 * Start a timer for a task.
 * Rules:
 * - Cannot start if a timer is already active (must stop first)
 * - Cannot start timer on a blocked task
 */
export async function startTimer(taskId: string): Promise<StartTimerResult> {
  // Rule: Only one active timer
  if (state.activeTimer) {
    return {
      success: false,
      reason: 'timer_active',
      message: 'A timer is already running. Stop it first.',
    };
  }

  try {
    // Check if task exists and is not blocked
    const task = await getTask(taskId);
    if (!task) {
      return {
        success: false,
        reason: 'task_not_found',
        message: 'Task not found.',
      };
    }

    // Rule: Timer start blocked on blocked tasks
    if (task.status === 'blocked') {
      return {
        success: false,
        reason: 'task_blocked',
        message: `Task is blocked: ${task.blockedReason || 'No reason specified'}`,
      };
    }

    // Create and persist the active timer
    const timer: ActiveTimer = {
      id: generateId(),
      taskId,
      startUtc: nowUtc(),
      source: 'manual',
    };

    await setActiveTimer(timer);
    setState({ activeTimer: timer, error: null });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start timer';
    setState({ error: message });
    return { success: false, reason: 'error', message };
  }
}

export type StopTimerResult =
  | { success: true; entry: TimeEntry }
  | { success: false; reason: 'no_active_timer' | 'error'; message: string };

/**
 * Stop the current timer and create a time entry.
 * Rule: Timer stop always allowed.
 */
export async function stopTimer(): Promise<StopTimerResult> {
  const { activeTimer } = state;

  if (!activeTimer) {
    return {
      success: false,
      reason: 'no_active_timer',
      message: 'No timer is running.',
    };
  }

  try {
    const now = nowUtc();

    // Create the time entry
    const entry: TimeEntry = {
      id: generateId(),
      taskId: activeTimer.taskId,
      startUtc: activeTimer.startUtc,
      endUtc: now,
      source: activeTimer.source,
      syncStatus: 'pending', // Will be synced when online
      createdAt: now,
      updatedAt: now,
    };

    // Persist the entry and clear the active timer
    await addTimeEntry(entry);
    await clearActiveTimer();

    setState({ activeTimer: null, error: null });

    return { success: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop timer';
    setState({ error: message });
    return { success: false, reason: 'error', message };
  }
}

/**
 * Discard the current timer without saving a time entry.
 * Use with caution - this loses time data.
 */
export async function discardTimer(): Promise<void> {
  try {
    await clearActiveTimer();
    setState({ activeTimer: null, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to discard timer';
    setState({ error: message });
  }
}

// ============================================================
// React Hooks
// ============================================================

/**
 * Subscribe to timer state changes.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get current snapshot of timer state.
 */
function getSnapshot(): TimerState {
  return state;
}

/**
 * React hook to access timer state.
 * Automatically re-renders when state changes.
 */
export function useTimerStore(): TimerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * React hook to get elapsed time in milliseconds.
 * Returns 0 if no timer is active.
 * Must be called within a component that updates on an interval for live display.
 */
export function useElapsedMs(): number {
  const { activeTimer } = useTimerStore();
  if (!activeTimer) return 0;
  return elapsedMs(activeTimer.startUtc);
}

/**
 * React hook providing timer actions.
 */
export function useTimerActions() {
  return {
    startTimer: useCallback(startTimer, []),
    stopTimer: useCallback(stopTimer, []),
    discardTimer: useCallback(discardTimer, []),
  };
}

// ============================================================
// Visibility Change Handler (Resume on Focus)
// ============================================================

/**
 * Handle visibility changes to ensure timer state is fresh.
 * When the app comes back to foreground, we recalculate from timestamps.
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Force re-render by notifying listeners
    // The elapsed time will be recalculated from timestamps
    notifyListeners();
  }
}

// Set up visibility change listener
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

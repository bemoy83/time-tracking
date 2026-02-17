/**
 * Timer store with React state management.
 * Supports multiple active timers (one per task).
 * Parallel toggle controls whether multiple tasks can run simultaneously.
 * - Parallel OFF (default): one timer app-wide (sequential)
 * - Parallel ON: one timer per task, multiple tasks simultaneously
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  getAllActiveTimers,
  addActiveTimer,
  removeActiveTimer,
  updateActiveTimer as dbUpdateActiveTimer,
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
// Parallel Toggle (localStorage-backed)
// ============================================================

const PARALLEL_KEY = 'parallelSubtaskTimers';

export function getParallelSubtaskTimers(): boolean {
  try {
    return localStorage.getItem(PARALLEL_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setParallelSubtaskTimers(enabled: boolean): void {
  try {
    localStorage.setItem(PARALLEL_KEY, String(enabled));
  } catch {
    // ignore
  }
}

// ============================================================
// Store State
// ============================================================

type TimerState = {
  activeTimers: ActiveTimer[];
  isLoading: boolean;
  error: string | null;
};

let state: TimerState = {
  activeTimers: [],
  isLoading: true,
  error: null,
};

// Subscribers for state changes
const listeners = new Set<() => void>();

export function notifyListeners() {
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
export async function initializeTimerStore(): Promise<void> {
  if (initialized) return;

  try {
    const timers = await getAllActiveTimers();
    setState({
      activeTimers: timers,
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
 * - Cannot start if this task already has a timer
 * - Parallel OFF: cannot start if any timer is active (must stop first)
 * - Cannot start timer on a blocked task
 */
export async function startTimer(taskId: string): Promise<StartTimerResult> {
  // Rule: One timer per task
  if (state.activeTimers.some((t) => t.taskId === taskId)) {
    return {
      success: false,
      reason: 'timer_active',
      message: 'A timer is already running for this task.',
    };
  }

  // Rule: Sequential mode — only one timer app-wide
  if (!getParallelSubtaskTimers() && state.activeTimers.length > 0) {
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
      workers: task.defaultWorkers != null
        ? Math.max(1, Math.min(20, Math.round(task.defaultWorkers)))
        : 1,
    };

    await addActiveTimer(timer);
    setState({ activeTimers: [...state.activeTimers, timer], error: null });

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
 * Stop the timer for a specific task and create a time entry.
 */
export async function stopTimer(taskId: string): Promise<StopTimerResult> {
  const activeTimer = state.activeTimers.find((t) => t.taskId === taskId);

  if (!activeTimer) {
    return {
      success: false,
      reason: 'no_active_timer',
      message: 'No timer is running for this task.',
    };
  }

  try {
    const now = nowUtc();

    const entry: TimeEntry = {
      id: generateId(),
      taskId: activeTimer.taskId,
      startUtc: activeTimer.startUtc,
      endUtc: now,
      source: activeTimer.source,
      workers: activeTimer.workers ?? 1,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await addTimeEntry(entry);
    await removeActiveTimer(taskId);

    setState({
      activeTimers: state.activeTimers.filter((t) => t.taskId !== taskId),
      error: null,
    });

    return { success: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop timer';
    setState({ error: message });
    return { success: false, reason: 'error', message };
  }
}

/**
 * Update the workers count on a task's active timer.
 */
export async function setTimerWorkers(taskId: string, count: number): Promise<void> {
  const timer = state.activeTimers.find((t) => t.taskId === taskId);
  if (!timer) return;

  const clamped = Math.max(1, Math.min(20, Math.round(count)));

  try {
    await dbUpdateActiveTimer(taskId, { workers: clamped });
    const updated = { ...timer, workers: clamped };
    setState({
      activeTimers: state.activeTimers.map((t) => (t.taskId === taskId ? updated : t)),
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update workers';
    setState({ error: message });
  }
}

/**
 * Discard a task's timer without saving a time entry.
 */
export async function discardTimer(taskId: string): Promise<void> {
  try {
    await removeActiveTimer(taskId);
    setState({
      activeTimers: state.activeTimers.filter((t) => t.taskId !== taskId),
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to discard timer';
    setState({ error: message });
  }
}

// ============================================================
// React Hooks
// ============================================================

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TimerState {
  return state;
}

/**
 * React hook to access timer state.
 */
export function useTimerStore(): TimerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * React hook to get elapsed time for a specific task's timer.
 * Returns 0 if no timer is active for that task.
 */
export function useElapsedMs(taskId?: string): number {
  const { activeTimers } = useTimerStore();
  if (!taskId) {
    // Sum all active timers
    return activeTimers.reduce((sum, t) => sum + elapsedMs(t.startUtc), 0);
  }
  const timer = activeTimers.find((t) => t.taskId === taskId);
  if (!timer) return 0;
  return elapsedMs(timer.startUtc);
}

/**
 * React hook providing timer actions.
 */
export function useTimerActions() {
  return {
    startTimer: useCallback(startTimer, []),
    stopTimer: useCallback(stopTimer, []),
    discardTimer: useCallback(discardTimer, []),
    setTimerWorkers: useCallback(setTimerWorkers, []),
  };
}

// ============================================================
// Compatibility Helpers
// ============================================================

/**
 * Get the active timer for a specific task from current state.
 * Convenience for components that need to check a single task.
 */
export function getActiveTimerForTask(taskId: string): ActiveTimer | null {
  return state.activeTimers.find((t) => t.taskId === taskId) ?? null;
}

// ============================================================
// Visibility Change Handler (Resume on Focus)
// ============================================================

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    notifyListeners();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Core type definitions for the time-tracking app.
 * All timestamps are UTC ISO strings for consistency.
 */

// Sync status for offline-first data
export type SyncStatus = 'pending' | 'synced' | 'conflict';

// Timer source indicates how a timer was started
// 'logged' = manually entered after the fact (not from a running timer)
export type TimerSource = 'manual' | 'resumed' | 'logged';

// Task status
export type TaskStatus = 'active' | 'completed' | 'blocked';

// Work unit types for quantity tracking
export type WorkUnit = 'm2' | 'm' | 'pcs' | 'kg' | 'L';

export const WORK_UNIT_LABELS: Record<WorkUnit, string> = {
  m2: 'm\u00B2',
  m: 'm',
  pcs: 'pcs',
  kg: 'kg',
  L: 'L',
};

export function formatWorkQuantity(quantity: number, unit: WorkUnit): string {
  return `${quantity} ${WORK_UNIT_LABELS[unit]}`;
}

export function formatProductivity(rate: number, unit: WorkUnit): string {
  const label = WORK_UNIT_LABELS[unit];
  const rounded = rate >= 10 ? Math.round(rate).toString() : rate.toFixed(1);
  return `${rounded} ${label}/person-hr`;
}

/**
 * Active timer state.
 * One per task max; multiple tasks can each have a timer.
 * Parents aggregate indirect timers from subtasks.
 * Time is calculated from timestamps, never from intervals.
 */
export interface ActiveTimer {
  id: string;
  taskId: string;
  startUtc: string; // ISO 8601 UTC timestamp
  source: TimerSource;
  workers: number; // crew size, defaults to 1
}

/**
 * Completed time entry.
 * Represents a finished timing session.
 */
export interface TimeEntry {
  id: string;
  taskId: string;
  startUtc: string; // ISO 8601 UTC timestamp
  endUtc: string; // ISO 8601 UTC timestamp
  source: TimerSource;
  workers: number; // crew size, defaults to 1
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task entity.
 * Can optionally belong to a project.
 * Can have one level of subtasks (parentId).
 */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string | null;
  parentId: string | null; // For one-level subtasks
  blockedReason: string | null; // Why the task is blocked
  estimatedMinutes: number | null; // Optional time budget
  workQuantity: number | null; // e.g. 120 for "120 m²"
  workUnit: WorkUnit | null; // e.g. 'm2'
  defaultWorkers: number | null; // Expected crew count; null = use 1
  createdAt: string;
  updatedAt: string;
}

/**
 * Project entity.
 * Groups related tasks together.
 */
export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Predefined project color palette.
 * High contrast, distinguishable colors for accessibility.
 */
export const PROJECT_COLORS: readonly string[] = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0891b2', // cyan
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#0d9488', // teal
] as const;

/**
 * Task note / activity log entry.
 * Append-only — no edit, no updatedAt.
 */
export interface TaskNote {
  id: string;
  taskId: string;
  text: string;        // plain text, max ~280 chars
  createdAt: string;   // ISO 8601 UTC
}

/**
 * Database schema definition for IndexedDB.
 */
export interface TimeTrackingDB {
  activeTimers: ActiveTimer;
  timeEntries: TimeEntry;
  tasks: Task;
  projects: Project;
}

/**
 * Utility function to generate a unique ID.
 * Uses crypto.randomUUID() which is available in modern browsers.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current UTC timestamp as ISO string.
 */
export function nowUtc(): string {
  return new Date().toISOString();
}

/**
 * Calculate elapsed milliseconds from a start timestamp to now.
 * Used for display purposes only - actual time is always from timestamps.
 */
export function elapsedMs(startUtc: string): number {
  const start = new Date(startUtc).getTime();
  const now = Date.now();
  return Math.max(0, now - start);
}

/**
 * Calculate duration in milliseconds between two timestamps.
 */
export function durationMs(startUtc: string, endUtc: string): number {
  const start = new Date(startUtc).getTime();
  const end = new Date(endUtc).getTime();
  return Math.max(0, end - start);
}

/**
 * Format milliseconds as HH:MM:SS string.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format milliseconds as floor-friendly short string.
 * Per PLAN §5.1: "1h 45m", "12m", "0m"
 * No small text, no dense tables - readable at a glance.
 */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);

  if (totalMinutes === 0) {
    return '0m';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Format person-hours: duration × workers, displayed like formatDurationShort.
 * person-ms = ms × workers
 */
export function formatPersonHours(ms: number, workers: number): string {
  return formatDurationShort(ms * workers);
}

/**
 * Format tracked time vs estimate: "1h 45m / 2h" when estimate set, "1h 45m" otherwise.
 */
export function formatTrackedVsEstimate(trackedMs: number, estimatedMinutes: number | null): string {
  const tracked = formatDurationShort(trackedMs);
  if (estimatedMinutes !== null && estimatedMinutes > 0) {
    return `${tracked} / ${formatDurationShort(estimatedMinutes * 60_000)}`;
  }
  return tracked;
}

/**
 * Format for badge: "tracked / estimate" when time tracked, "estimate" only when no time tracked.
 * Returns empty string when no estimate.
 */
export function formatTrackedVsEstimateBadge(
  trackedMs: number,
  estimatedMinutes: number | null
): string {
  if (estimatedMinutes === null || estimatedMinutes <= 0) return '';
  const estimate = formatDurationShort(estimatedMinutes * 60_000);
  if (trackedMs > 0) {
    return `${formatDurationShort(trackedMs)} / ${estimate}`;
  }
  return estimate;
}

/**
 * Budget status for comparing tracked vs estimated time.
 */
export type BudgetLevel = 'under' | 'approaching' | 'over' | 'none';

export interface BudgetStatus {
  status: BudgetLevel;
  percentUsed: number;
  varianceMs: number; // positive = over budget, negative = under
  varianceText: string; // "Over by 25m" / "Under by 1h 15m"
}

/**
 * Calculate budget status from tracked time and estimate.
 * Thresholds: green < 75%, amber 75–99%, red >= 100%.
 */
export function calculateBudgetStatus(
  trackedMs: number,
  estimatedMinutes: number | null
): BudgetStatus {
  if (estimatedMinutes === null || estimatedMinutes <= 0) {
    return { status: 'none', percentUsed: 0, varianceMs: 0, varianceText: '' };
  }

  const estimatedMs = estimatedMinutes * 60_000;
  const percentUsed = (trackedMs / estimatedMs) * 100;
  const varianceMs = trackedMs - estimatedMs;

  let status: BudgetLevel;
  if (percentUsed >= 100) {
    status = 'over';
  } else if (percentUsed >= 75) {
    status = 'approaching';
  } else {
    status = 'under';
  }

  const absVariance = Math.abs(varianceMs);
  const prefix = varianceMs >= 0 ? 'Over by ' : 'Under by ';
  const varianceText = prefix + formatDurationShort(absVariance);

  return { status, percentUsed, varianceMs, varianceText };
}

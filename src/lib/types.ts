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

/**
 * Active timer state.
 * Only one timer can be active at a time.
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
 * Database schema definition for IndexedDB.
 */
export interface TimeTrackingDB {
  activeTimer: ActiveTimer;
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

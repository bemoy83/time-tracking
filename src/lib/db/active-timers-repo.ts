import type { ActiveTimer } from '../types';
import { getDB } from './core';

/**
 * Get all active timers.
 */
export async function getAllActiveTimers(): Promise<ActiveTimer[]> {
  const db = await getDB();
  return db.getAll('activeTimers');
}

export async function deleteAllActiveTimers(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('activeTimers', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

/**
 * Get the active timer for a specific task, if any.
 */
export async function getActiveTimerByTask(taskId: string): Promise<ActiveTimer | null> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  return timer ?? null;
}

/**
 * Add an active timer. Each task may have at most one.
 */
export async function addActiveTimer(timer: ActiveTimer): Promise<void> {
  const db = await getDB();
  await db.add('activeTimers', timer);
}

/**
 * Remove the active timer for a specific task.
 */
export async function removeActiveTimer(taskId: string): Promise<void> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  if (timer) {
    await db.delete('activeTimers', timer.id);
  }
}

/**
 * Update fields on an active timer for a specific task.
 */
export async function updateActiveTimer(taskId: string, updates: Partial<ActiveTimer>): Promise<void> {
  const db = await getDB();
  const timer = await db.getFromIndex('activeTimers', 'by-task', taskId);
  if (timer) {
    await db.put('activeTimers', { ...timer, ...updates, id: timer.id, taskId: timer.taskId });
  }
}

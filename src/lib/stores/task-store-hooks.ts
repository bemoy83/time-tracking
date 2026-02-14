/**
 * React hooks for the task store.
 * Separated from task-store.ts to keep the main file under 500 lines.
 */

import { useSyncExternalStore } from 'react';
import { Task } from '../types';
import { subscribe, getSnapshot } from './task-store';

/**
 * React hook to access task store state.
 */
export function useTaskStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to get a single task by ID.
 */
export function useTask(id: string): Task | undefined {
  const { tasks } = useTaskStore();
  return tasks.find((t) => t.id === id);
}

/**
 * Hook to get subtasks of a parent.
 */
export function useSubtasks(parentId: string): Task[] {
  const { tasks } = useTaskStore();
  return tasks.filter((t) => t.parentId === parentId);
}

/**
 * Hook to get tasks for a project (top-level only).
 */
export function useProjectTasks(projectId: string | null): Task[] {
  const { tasks } = useTaskStore();
  return tasks.filter((t) => t.projectId === projectId && t.parentId === null);
}

/**
 * Hook to get active tasks (top-level, non-completed).
 */
export function useActiveTasks(): Task[] {
  const { tasks } = useTaskStore();
  return tasks.filter((t) => t.status !== 'completed' && t.parentId === null);
}

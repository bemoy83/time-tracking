/**
 * Task and Project store with React state management.
 * Provides CRUD operations and React hooks for tasks and projects.
 */

import {
  getAllTasks,
  getAllProjects,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  addProject as dbAddProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  getTimeEntriesByTask,
  deleteTimeEntriesByTask,
  deleteTask as dbDeleteTask,
  getAllActiveTimers,
} from '../db';
import { Task, Project, PROJECT_COLORS, generateId, nowUtc, durationMs, elapsedMs } from '../types';
import { stopTimer } from './timer-store';

// ============================================================
// Store State
// ============================================================

type TaskStoreState = {
  tasks: Task[];
  projects: Project[];
  isLoading: boolean;
  error: string | null;
};

let state: TaskStoreState = {
  tasks: [],
  projects: [],
  isLoading: true,
  error: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getState(): TaskStoreState {
  return state;
}

export function setState(partial: Partial<TaskStoreState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Store Initialization
// ============================================================

let initialized = false;

/**
 * Initialize the task store by loading from IndexedDB.
 */
export async function initializeTaskStore(): Promise<void> {
  if (initialized) return;

  try {
    const [tasks, projects] = await Promise.all([
      getAllTasks(),
      getAllProjects(),
    ]);
    setState({
      tasks,
      projects,
      isLoading: false,
      error: null,
    });
    initialized = true;
  } catch (err) {
    setState({
      isLoading: false,
      error: err instanceof Error ? err.message : 'Failed to load tasks',
    });
  }
}

/**
 * Refresh tasks from database.
 */
export async function refreshTasks(): Promise<void> {
  try {
    const tasks = await getAllTasks();
    setState({ tasks, error: null });
  } catch (err) {
    setState({
      error: err instanceof Error ? err.message : 'Failed to refresh tasks',
    });
  }
}

// ============================================================
// Task Actions
// ============================================================

export interface CreateTaskInput {
  title: string;
  projectId?: string | null;
  parentId?: string | null;
  estimatedMinutes?: number | null;
}

/**
 * Create a new task.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const now = nowUtc();
  const task: Task = {
    id: generateId(),
    title: input.title,
    status: 'active',
    projectId: input.projectId ?? null,
    parentId: input.parentId ?? null,
    blockedReason: null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddTask(task);
  setState({ tasks: [...state.tasks, task] });
  return task;
}

/**
 * Update a task's title.
 */
export async function updateTaskTitle(id: string, title: string): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated = { ...task, title, updatedAt: nowUtc() };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Update a task's estimated time in minutes.
 */
export async function updateTaskEstimate(id: string, estimatedMinutes: number | null): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated = { ...task, estimatedMinutes, updatedAt: nowUtc() };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Mark a task as completed.
 */
export async function completeTask(id: string): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated: Task = { ...task, status: 'completed', updatedAt: nowUtc() };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Complete a parent task and all its subtasks.
 * Stops any active timers on affected tasks first.
 */
export async function completeTaskAndChildren(parentId: string): Promise<void> {
  const parent = state.tasks.find((t) => t.id === parentId);
  if (!parent) return;

  const children = state.tasks.filter((t) => t.parentId === parentId);
  const allIds = [parentId, ...children.map((c) => c.id)];

  // Stop timers if active on any affected task
  const activeTimers = await getAllActiveTimers();
  for (const timer of activeTimers) {
    if (allIds.includes(timer.taskId)) {
      await stopTimer(timer.taskId);
    }
  }

  const now = nowUtc();
  const updates: Task[] = [];

  // Complete children first
  for (const child of children) {
    if (child.status !== 'completed') {
      const updated: Task = { ...child, status: 'completed', updatedAt: now };
      await dbUpdateTask(updated);
      updates.push(updated);
    }
  }

  // Complete parent
  const updatedParent: Task = { ...parent, status: 'completed', updatedAt: now };
  await dbUpdateTask(updatedParent);
  updates.push(updatedParent);

  // Batch state update
  const updatedMap = new Map(updates.map((u) => [u.id, u]));
  setState({
    tasks: state.tasks.map((t) => updatedMap.get(t.id) ?? t),
  });
}

/**
 * Reactivate a completed task.
 */
export async function reactivateTask(id: string): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated: Task = {
    ...task,
    status: 'active',
    blockedReason: null,
    updatedAt: nowUtc(),
  };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Block a task with a reason.
 */
export async function blockTask(id: string, reason: string): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated: Task = {
    ...task,
    status: 'blocked',
    blockedReason: reason,
    updatedAt: nowUtc(),
  };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Unblock a task.
 */
export async function unblockTask(id: string): Promise<void> {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const updated: Task = {
    ...task,
    status: 'active',
    blockedReason: null,
    updatedAt: nowUtc(),
  };
  await dbUpdateTask(updated);
  setState({
    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
  });
}

/**
 * Assign task to a project.
 */
export async function assignToProject(
  taskId: string,
  projectId: string | null
): Promise<void> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  const now = nowUtc();
  const updated = { ...task, projectId, updatedAt: now };
  await dbUpdateTask(updated);

  // Cascade to subtasks
  const subtasks = state.tasks.filter((t) => t.parentId === taskId);
  const updatedSubtasks = subtasks.map((s) => ({ ...s, projectId, updatedAt: now }));
  for (const s of updatedSubtasks) {
    await dbUpdateTask(s);
  }

  setState({
    tasks: state.tasks.map((t) => {
      if (t.id === taskId) return updated;
      if (t.parentId === taskId) return updatedSubtasks.find((s) => s.id === t.id) ?? t;
      return t;
    }),
  });
}

// ============================================================
// Delete Task Operations (re-exported from task-store-delete.ts)
// ============================================================

export type { DeletePreview } from './task-store-delete';
export { getDeletePreview, deleteTaskWithEntries } from './task-store-delete';

// ============================================================
// Project Actions
// ============================================================

/**
 * Create a new project.
 */
export async function createProject(name: string, color?: string): Promise<Project> {
  const now = nowUtc();
  const usedColors = new Set(state.projects.map((p) => p.color));
  const defaultColor = PROJECT_COLORS.find((c) => !usedColors.has(c)) ?? PROJECT_COLORS[0];

  const project: Project = {
    id: generateId(),
    name,
    color: color ?? defaultColor,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddProject(project);
  setState({ projects: [...state.projects, project] });
  return project;
}

/**
 * Update a project's name.
 */
export async function updateProjectName(id: string, name: string): Promise<void> {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;

  const updated = { ...project, name, updatedAt: nowUtc() };
  await dbUpdateProject(updated);
  setState({
    projects: state.projects.map((p) => (p.id === id ? updated : p)),
  });
}

/**
 * Update a project's color.
 */
export async function updateProjectColor(id: string, color: string): Promise<void> {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;

  const updated = { ...project, color, updatedAt: nowUtc() };
  await dbUpdateProject(updated);
  setState({
    projects: state.projects.map((p) => (p.id === id ? updated : p)),
  });
}

/**
 * Preview info for project deletion.
 */
export interface DeleteProjectPreview {
  taskCount: number;
  totalTimeMs: number;
}

/**
 * Get preview info for deleting a project.
 */
export async function getDeleteProjectPreview(projectId: string): Promise<DeleteProjectPreview> {
  const projectTasks = state.tasks.filter((t) => t.projectId === projectId);
  let totalTimeMs = 0;
  const activeTimers = await getAllActiveTimers();

  for (const task of projectTasks) {
    const entries = await getTimeEntriesByTask(task.id);
    for (const entry of entries) {
      totalTimeMs += durationMs(entry.startUtc, entry.endUtc);
    }
    const timer = activeTimers.find((t) => t.taskId === task.id);
    if (timer) {
      totalTimeMs += elapsedMs(timer.startUtc);
    }
  }

  return { taskCount: projectTasks.length, totalTimeMs };
}

/**
 * Delete a project.
 * @param mode 'unassign' clears projectId on tasks; 'delete_tasks' deletes all tasks and their entries.
 */
export async function deleteProjectWithMode(
  projectId: string,
  mode: 'unassign' | 'delete_tasks'
): Promise<void> {
  const projectTasks = state.tasks.filter((t) => t.projectId === projectId);

  // Stop active timers if on any affected task
  const activeTimers2 = await getAllActiveTimers();
  for (const timer of activeTimers2) {
    if (projectTasks.some((t) => t.id === timer.taskId)) {
      await stopTimer(timer.taskId);
    }
  }

  if (mode === 'unassign') {
    // Clear projectId on all tasks
    for (const task of projectTasks) {
      const updated = { ...task, projectId: null, updatedAt: nowUtc() };
      await dbUpdateTask(updated);
    }
    await dbDeleteProject(projectId);
    setState({
      tasks: state.tasks.map((t) =>
        t.projectId === projectId ? { ...t, projectId: null, updatedAt: nowUtc() } : t
      ),
      projects: state.projects.filter((p) => p.id !== projectId),
    });
  } else {
    // Delete all tasks (including subtasks) and their time entries
    for (const task of projectTasks) {
      // Delete subtasks first
      const subtasks = state.tasks.filter((t) => t.parentId === task.id);
      for (const sub of subtasks) {
        await deleteTimeEntriesByTask(sub.id);
        await dbDeleteTask(sub.id);
      }
      await deleteTimeEntriesByTask(task.id);
      await dbDeleteTask(task.id);
    }
    await dbDeleteProject(projectId);

    const deletedIds = new Set<string>();
    for (const task of projectTasks) {
      deletedIds.add(task.id);
      state.tasks.filter((t) => t.parentId === task.id).forEach((s) => deletedIds.add(s.id));
    }

    setState({
      tasks: state.tasks.filter((t) => !deletedIds.has(t.id)),
      projects: state.projects.filter((p) => p.id !== projectId),
    });
  }
}

// ============================================================
// Selectors (Derived Data)
// ============================================================

/**
 * Get tasks grouped by project.
 */
export function getTasksByProjectId(projectId: string | null): Task[] {
  return state.tasks.filter((t) => t.projectId === projectId && t.parentId === null);
}

/**
 * Get subtasks of a parent task.
 */
export function getSubtasksOf(parentId: string): Task[] {
  return state.tasks.filter((t) => t.parentId === parentId);
}

/**
 * Get active (non-completed) tasks.
 */
export function getActiveTasks(): Task[] {
  return state.tasks.filter((t) => t.status !== 'completed' && t.parentId === null);
}

/**
 * Get a single task by ID.
 */
export function getTaskById(id: string): Task | undefined {
  return state.tasks.find((t) => t.id === id);
}

/**
 * Get a project by ID.
 */
export function getProjectById(id: string): Project | undefined {
  return state.projects.find((p) => p.id === id);
}

// ============================================================
// React Hooks (re-exported from task-store-hooks.ts)
// ============================================================

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): TaskStoreState {
  return state;
}

export { useTaskStore, useTask, useSubtasks, useProjectTasks, useActiveTasks } from './task-store-hooks';

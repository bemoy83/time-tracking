import type { Project, Task } from '../types';

export type TaskStoreState = {
  tasks: Task[];
  projects: Project[];
  isLoading: boolean;
  error: string | null;
};

export let state: TaskStoreState = {
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

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): TaskStoreState {
  return state;
}

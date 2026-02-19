/**
 * Template store with React state management.
 * Provides CRUD operations for task templates.
 */

import {
  getAllTaskTemplates,
  addTaskTemplate as dbAddTemplate,
  updateTaskTemplate as dbUpdateTemplate,
  deleteTaskTemplate as dbDeleteTemplate,
} from '../db';
import {
  TaskTemplate,
  WorkUnit,
  BuildPhase,
  WorkCategory,
  generateId,
  nowUtc,
} from '../types';

// ============================================================
// Store State
// ============================================================

type TemplateStoreState = {
  templates: TaskTemplate[];
  isLoading: boolean;
};

let state: TemplateStoreState = {
  templates: [],
  isLoading: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setState(partial: Partial<TemplateStoreState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Store Initialization
// ============================================================

let initialized = false;

export async function initializeTemplateStore(): Promise<void> {
  if (initialized) return;

  try {
    const templates = await getAllTaskTemplates();
    setState({ templates, isLoading: false });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

// ============================================================
// Template Actions
// ============================================================

export interface CreateTemplateInput {
  title: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  workCategory: WorkCategory;
  workQuantity?: number | null;
  estimatedMinutes?: number | null;
  defaultWorkers?: number | null;
  targetProductivity?: number | null;
}

export async function createTemplate(input: CreateTemplateInput): Promise<TaskTemplate> {
  const now = nowUtc();
  const template: TaskTemplate = {
    id: generateId(),
    title: input.title,
    workUnit: input.workUnit,
    workQuantity: input.workQuantity ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    defaultWorkers: input.defaultWorkers ?? null,
    targetProductivity: input.targetProductivity ?? null,
    buildPhase: input.buildPhase,
    workCategory: input.workCategory,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddTemplate(template);
  setState({ templates: [...state.templates, template] });
  return template;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>
): Promise<void> {
  const template = state.templates.find((t) => t.id === id);
  if (!template) return;

  const updated: TaskTemplate = { ...template, ...updates, id, createdAt: template.createdAt, updatedAt: nowUtc() };
  await dbUpdateTemplate(updated);
  setState({
    templates: state.templates.map((t) => (t.id === id ? updated : t)),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await dbDeleteTemplate(id);
  setState({
    templates: state.templates.filter((t) => t.id !== id),
  });
}

export function resetTemplateState() {
  setState({ templates: [] });
}

// ============================================================
// Selectors
// ============================================================

export function getTemplateById(id: string): TaskTemplate | undefined {
  return state.templates.find((t) => t.id === id);
}

// ============================================================
// React Integration
// ============================================================

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): TemplateStoreState {
  return state;
}

export { useTemplateStore } from './template-store-hooks';

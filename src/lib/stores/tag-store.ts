/**
 * Global tag store.
 * Manages TagCategory and Tag entities with full CRUD and cascade delete.
 *
 * Follows the same useSyncExternalStore pattern as work-type-store.ts.
 */

import { useSyncExternalStore } from 'react';
import {
  getAllTagCategories,
  addTagCategory as dbAddTagCategory,
  updateTagCategory as dbUpdateTagCategory,
  deleteTagCategory as dbDeleteTagCategory,
  getAllTags,
  addTag as dbAddTag,
  updateTag as dbUpdateTag,
  deleteTag as dbDeleteTag,
  getAllWorkTypes,
  updateWorkType,
  getAllTasks,
  updateTask,
  getAllPlans,
  updatePlan,
} from '../db';
import type { Tag, TagCategory } from '../tags';
import {
  normalizeTagName,
  normalizeTagCategoryName,
  TAG_COLOR_DEFAULT,
} from '../tags';
import { generateId, nowUtc } from '../types';

// ============================================================
// Store State
// ============================================================

type TagStoreState = {
  categories: TagCategory[];
  tags: Tag[];
  isLoading: boolean;
};

let state: TagStoreState = {
  categories: [],
  tags: [],
  isLoading: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<TagStoreState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

// ============================================================
// Initialization
// ============================================================

let initialized = false;

export async function initializeTagStore(): Promise<void> {
  if (initialized) return;
  try {
    const [categories, tags] = await Promise.all([
      getAllTagCategories(),
      getAllTags(),
    ]);
    setState({ categories, tags, isLoading: false });
    initialized = true;
  } catch {
    setState({ isLoading: false });
  }
}

export function resetTagStoreState(): void {
  initialized = false;
  setState({ categories: [], tags: [], isLoading: true });
}

// ============================================================
// TagCategory Actions
// ============================================================

export interface CreateTagCategoryInput {
  name: string;
}

export async function createTagCategory(
  input: CreateTagCategoryInput,
): Promise<TagCategory> {
  const normalized = normalizeTagCategoryName(input.name);
  if (!normalized) throw new Error('Category name cannot be empty');

  const duplicate = state.categories.find(
    (c) => normalizeTagCategoryName(c.name) === normalized,
  );
  if (duplicate) {
    throw new Error(`Tag category "${input.name}" already exists`);
  }

  const maxOrder = state.categories.reduce(
    (max, c) => Math.max(max, c.sortOrder),
    -1,
  );
  const now = nowUtc();
  const category: TagCategory = {
    id: generateId(),
    name: input.name.trim(),
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddTagCategory(category);
  setState({ categories: [...state.categories, category] });
  return category;
}

export async function updateTagCategoryFields(
  id: string,
  updates: Partial<Pick<TagCategory, 'name' | 'sortOrder'>>,
): Promise<void> {
  const category = state.categories.find((c) => c.id === id);
  if (!category) return;

  if (updates.name !== undefined) {
    const normalized = normalizeTagCategoryName(updates.name);
    const duplicate = state.categories.find(
      (c) => c.id !== id && normalizeTagCategoryName(c.name) === normalized,
    );
    if (duplicate) {
      throw new Error(`Tag category "${updates.name}" already exists`);
    }
  }

  const updated: TagCategory = {
    ...category,
    ...updates,
    id,
    createdAt: category.createdAt,
    updatedAt: nowUtc(),
  };
  await dbUpdateTagCategory(updated);
  setState({
    categories: state.categories.map((c) => (c.id === id ? updated : c)),
  });
}

/**
 * Delete a tag category.
 * Also deletes all tags in that category, with full cascade
 * (removes tag IDs from workTypes, tasks, and plan lineItems).
 */
export async function removeTagCategory(id: string): Promise<void> {
  const tagsInCategory = state.tags.filter((t) => t.categoryId === id);
  for (const tag of tagsInCategory) {
    await _cascadeDeleteTag(tag.id);
  }
  await dbDeleteTagCategory(id);
  setState({
    categories: state.categories.filter((c) => c.id !== id),
    tags: state.tags.filter((t) => t.categoryId !== id),
  });
}

// ============================================================
// Tag Actions
// ============================================================

export interface CreateTagInput {
  categoryId: string;
  name: string;
  color?: string;
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  const category = state.categories.find((c) => c.id === input.categoryId);
  if (!category) throw new Error('Tag category not found');

  const normalized = normalizeTagName(input.name);
  if (!normalized) throw new Error('Tag name cannot be empty');

  // Names must be unique within a category
  const duplicate = state.tags.find(
    (t) =>
      t.categoryId === input.categoryId &&
      normalizeTagName(t.name) === normalized,
  );
  if (duplicate) {
    throw new Error(
      `Tag "${input.name}" already exists in category "${category.name}"`,
    );
  }

  const now = nowUtc();
  const tag: Tag = {
    id: generateId(),
    categoryId: input.categoryId,
    name: input.name.trim(),
    color: input.color ?? TAG_COLOR_DEFAULT,
    sequencable: false,
    createdAt: now,
    updatedAt: now,
  };

  await dbAddTag(tag);
  setState({ tags: [...state.tags, tag] });
  return tag;
}

export async function updateTagFields(
  id: string,
  updates: Partial<Pick<Tag, 'name' | 'color' | 'sequencable'>>,
): Promise<void> {
  const tag = state.tags.find((t) => t.id === id);
  if (!tag) return;

  if (updates.name !== undefined) {
    const normalized = normalizeTagName(updates.name);
    const duplicate = state.tags.find(
      (t) =>
        t.id !== id &&
        t.categoryId === tag.categoryId &&
        normalizeTagName(t.name) === normalized,
    );
    if (duplicate) {
      throw new Error(`Tag "${updates.name}" already exists in this category`);
    }
  }

  const updated: Tag = {
    ...tag,
    ...updates,
    id,
    createdAt: tag.createdAt,
    updatedAt: nowUtc(),
  };
  await dbUpdateTag(updated);
  setState({ tags: state.tags.map((t) => (t.id === id ? updated : t)) });
}

/**
 * Delete a tag and cascade: removes the tag ID from all workTypes,
 * tasks, and plan lineItems that reference it.
 */
export async function removeTag(id: string): Promise<void> {
  await _cascadeDeleteTag(id);
  await dbDeleteTag(id);
  setState({ tags: state.tags.filter((t) => t.id !== id) });
}

// ============================================================
// Cascade Delete (internal)
// ============================================================

async function _cascadeDeleteTag(tagId: string): Promise<void> {
  // Remove from workTypes
  const workTypes = await getAllWorkTypes();
  for (const wt of workTypes) {
    if (wt.tagIds?.includes(tagId)) {
      await updateWorkType({
        ...wt,
        tagIds: wt.tagIds.filter((id) => id !== tagId),
        updatedAt: nowUtc(),
      });
    }
  }

  // Remove from tasks (additionalTagIds)
  const tasks = await getAllTasks();
  for (const task of tasks) {
    if (task.additionalTagIds?.includes(tagId)) {
      await updateTask({
        ...task,
        additionalTagIds: task.additionalTagIds.filter((id) => id !== tagId),
        updatedAt: nowUtc(),
      });
    }
  }

  // Remove from plan lineItems (tagIds snapshot)
  const plans = await getAllPlans();
  for (const plan of plans) {
    const hasRef = plan.lineItems.some((item) =>
      item.tagIds?.includes(tagId),
    );
    if (hasRef) {
      await updatePlan({
        ...plan,
        lineItems: plan.lineItems.map((item) =>
          item.tagIds?.includes(tagId)
            ? { ...item, tagIds: item.tagIds.filter((id) => id !== tagId) }
            : item,
        ),
        updatedAt: nowUtc(),
      });
    }
  }
}

// ============================================================
// Selectors
// ============================================================

export function getTagById(id: string): Tag | undefined {
  return state.tags.find((t) => t.id === id);
}

export function getTagsByIds(ids: string[]): Tag[] {
  const set = new Set(ids);
  return state.tags.filter((t) => set.has(t.id));
}

export function getCategoryById(id: string): TagCategory | undefined {
  return state.categories.find((c) => c.id === id);
}

export function getTagsForCategory(categoryId: string): Tag[] {
  return state.tags
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns categories sorted by sortOrder, each with their tags. */
export function getCategoriesWithTags(): Array<{
  category: TagCategory;
  tags: Tag[];
}> {
  return [...state.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      category,
      tags: getTagsForCategory(category.id),
    }));
}

// ============================================================
// React Integration
// ============================================================

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): TagStoreState {
  return state;
}

export function useTagStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

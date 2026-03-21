/**
 * useTagFilter — reusable tag filter state management.
 *
 * Handles:
 *   - Which tags are available in the current context (resolved from store)
 *   - Category-based browsing (which category is selected in the UI)
 *   - Search query filtering of the displayed tag list
 *   - Active tag filter set (drives item filtering in the caller)
 *   - Auto-reset when the context key changes (e.g. plan or project switches)
 *
 * The hook manages only UI and filter state — the caller is responsible for
 * applying `activeTagFilters` to its own items, since each view knows how to
 * extract tag IDs from its data shape.
 *
 * Usage:
 *   const tagFilter = useTagFilter(availableTagIds, { resetKey: planId });
 *   // Pass tagFilter to <TagFilterPanel />
 *   // Use tagFilter.activeTagFilters to filter your own items
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Tag, TagCategory } from '../lib/tags';
import { useTagStore } from '../lib/stores/tag-store';

export interface TagFilterCategory {
  category: TagCategory;
  tags: Tag[];
}

export interface UseTagFilterResult {
  /** Tag IDs currently selected as active filters. Apply these to your items. */
  activeTagFilters: Set<string>;
  /** Current text in the search field. */
  tagSearchQuery: string;
  /** Selected category chip ID, or null for "All". */
  selectedCategoryId: string | null;
  /**
   * Categories that have at least one tag present in the current context,
   * sorted by category sortOrder. Each entry includes the resolved Tag objects.
   * Empty when no tags are present.
   */
  availableCategories: TagFilterCategory[];
  /**
   * Tags to display in the panel, filtered by selectedCategoryId and
   * tagSearchQuery. Sorted alphabetically by name.
   */
  displayedTags: Tag[];
  /** True when at least one tag is in activeTagFilters. */
  hasActiveFilters: boolean;
  toggleTagFilter: (tagId: string) => void;
  setTagSearchQuery: (q: string) => void;
  setSelectedCategoryId: (id: string | null) => void;
  /** Clears activeTagFilters only. Does not reset search or category. */
  clearTagFilters: () => void;
  /** Resets all state: activeTagFilters, search, and selected category. */
  resetTagFilter: () => void;
}

export interface UseTagFilterOptions {
  /**
   * When this value changes, all filter state resets automatically.
   * Pass a plan ID, project ID, or any value that identifies the context.
   */
  resetKey?: unknown;
}

export function useTagFilter(
  availableTagIds: string[],
  options?: UseTagFilterOptions,
): UseTagFilterResult {
  const { tags, categories } = useTagStore();

  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Auto-reset all filter state when the context key changes
  const resetKey = options?.resetKey;
  useEffect(() => {
    setActiveTagFilters(new Set());
    setTagSearchQuery('');
    setSelectedCategoryId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const availableTagIdSet = useMemo(() => new Set(availableTagIds), [availableTagIds]);

  // Tags present in the current context, resolved from the store
  const availableTags = useMemo(
    () => tags.filter((t) => availableTagIdSet.has(t.id)),
    [tags, availableTagIdSet],
  );

  // Categories with at least one available tag, sorted by sortOrder
  const availableCategories = useMemo((): TagFilterCategory[] => {
    const presentCategoryIds = new Set(availableTags.map((t) => t.categoryId));
    return [...categories]
      .filter((c) => presentCategoryIds.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        category,
        tags: availableTags
          .filter((t) => t.categoryId === category.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [availableTags, categories]);

  // Tags shown in the panel: filtered by selected category and search query
  const displayedTags = useMemo(() => {
    let list = availableTags;
    if (selectedCategoryId !== null) {
      list = list.filter((t) => t.categoryId === selectedCategoryId);
    }
    const q = tagSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableTags, selectedCategoryId, tagSearchQuery]);

  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  const clearTagFilters = useCallback(() => {
    setActiveTagFilters(new Set());
  }, []);

  const resetTagFilter = useCallback(() => {
    setActiveTagFilters(new Set());
    setTagSearchQuery('');
    setSelectedCategoryId(null);
  }, []);

  return {
    activeTagFilters,
    tagSearchQuery,
    selectedCategoryId,
    availableCategories,
    displayedTags,
    hasActiveFilters: activeTagFilters.size > 0,
    toggleTagFilter,
    setTagSearchQuery,
    setSelectedCategoryId,
    clearTagFilters,
    resetTagFilter,
  };
}

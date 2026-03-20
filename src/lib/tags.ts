/**
 * Tag system type definitions and utilities.
 *
 * Tags are globally managed entities used to classify and organize
 * WorkTypes and Tasks. They are created/managed in Settings only —
 * no freeform creation in task or plan editing flows.
 *
 * Organization:
 *   TagCategory (e.g. "Resource", "Location", "Team")
 *     └── Tag (e.g. "Furniture", "Hall A", "Crew 1")
 *
 * Assignment model:
 *   WorkType.tagIds[]         → default tags for all tasks of that type
 *   Task.additionalTagIds[]   → extra tags added per-task
 *   effective tags            = WorkType.tagIds + Task.additionalTagIds
 *
 * WorkType tags are always present on a task and cannot be removed
 * at the task level. Only additional tags can be managed per-task.
 */

// ============================================================
// Interfaces
// ============================================================

export interface TagCategory {
  id: string;
  name: string;      // e.g. "Resource", "Location", "Material", "Team"
  /** Display order in pickers and settings. Lower = first. */
  sortOrder: number;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string;
}

export interface Tag {
  id: string;
  categoryId: string; // references TagCategory.id
  name: string;       // e.g. "Furniture", "Hall A", "Crew 1"
  color: string;      // hex color for pill display, e.g. "#2563eb"
  /**
   * Phase 2: when true, this tag participates in global execution ordering.
   * Backfilled as false for all existing tags at migration time.
   */
  sequencable: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Color Palette
// ============================================================

/**
 * Predefined tag color palette.
 * Intentionally distinct from PROJECT_COLORS to avoid visual confusion.
 */
export const TAG_COLORS: readonly string[] = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#ea580c', // orange
  '#db2777', // pink
  '#0d9488', // teal
  '#4b5563', // slate
] as const;

export const TAG_COLOR_DEFAULT = TAG_COLORS[0];

// ============================================================
// Normalization
// ============================================================

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeTagCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ============================================================
// Effective Tag Resolution
// ============================================================

/**
 * Compute the full set of tag IDs for a task.
 * = WorkType's tags (always present, locked in) + task's additional tags
 *
 * WorkType tags are never overridden at the task level.
 * Additional tags are deduplicated against base tags.
 */
export function resolveEffectiveTagIds(
  workTypeTagIds: string[],
  additionalTagIds: string[],
): string[] {
  const base = workTypeTagIds;
  const baseSet = new Set(base);
  const extra = additionalTagIds.filter((id) => !baseSet.has(id));
  return [...base, ...extra];
}

/**
 * Given the effective tag IDs for a task and the available tags from the store,
 * return the tags grouped by category, sorted by category sortOrder then tag name.
 */
export function groupTagsByCategory(
  tagIds: string[],
  tagsById: Map<string, Tag>,
  categoriesById: Map<string, TagCategory>,
): Array<{ category: TagCategory; tags: Tag[] }> {
  const grouped = new Map<string, Tag[]>();

  for (const id of tagIds) {
    const tag = tagsById.get(id);
    if (!tag) continue;
    const group = grouped.get(tag.categoryId) ?? [];
    group.push(tag);
    grouped.set(tag.categoryId, group);
  }

  const result: Array<{ category: TagCategory; tags: Tag[] }> = [];
  for (const [categoryId, tags] of grouped) {
    const category = categoriesById.get(categoryId);
    if (!category) continue;
    result.push({
      category,
      tags: tags.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return result.sort((a, b) => a.category.sortOrder - b.category.sortOrder);
}

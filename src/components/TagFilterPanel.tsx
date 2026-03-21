/**
 * TagFilterPanel — reusable tag filter UI.
 *
 * Renders a search field, a horizontally-scrolling category chip bar, and a
 * horizontally-scrolling tag chip row. Designed for mobile-first, touch-friendly
 * interaction.
 *
 * Intended to be driven by `useTagFilter`. The caller owns the filter state and
 * is responsible for applying `activeTagFilters` to its own item list.
 *
 * The panel renders nothing if no tag categories are available.
 *
 * CSS namespace: `.tag-filter`
 */

import type { Tag, TagCategory } from '../lib/tags';

interface TagFilterCategory {
  category: TagCategory;
  tags: Tag[];
}

interface TagFilterPanelProps {
  activeTagFilters: Set<string>;
  tagSearchQuery: string;
  selectedCategoryId: string | null;
  availableCategories: TagFilterCategory[];
  displayedTags: Tag[];
  hasActiveFilters: boolean;
  onToggleTag: (tagId: string) => void;
  onSearchChange: (q: string) => void;
  onCategoryChange: (id: string | null) => void;
  onClearFilters: () => void;
}

export function TagFilterPanel({
  activeTagFilters,
  tagSearchQuery,
  selectedCategoryId,
  availableCategories,
  displayedTags,
  hasActiveFilters,
  onToggleTag,
  onSearchChange,
  onCategoryChange,
  onClearFilters,
}: TagFilterPanelProps) {
  if (availableCategories.length === 0) return null;

  const showCategoryStrip = availableCategories.length >= 2;

  return (
    <div className="tag-filter">
      {/* Search + Clear row */}
      <div className="tag-filter__search-row">
        <input
          type="search"
          className="tag-filter__search"
          placeholder="Filter by tag…"
          value={tagSearchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Filter tags by name"
        />
        {hasActiveFilters && (
          <button
            type="button"
            className="tag-filter__clear"
            onClick={onClearFilters}
          >
            Clear
          </button>
        )}
      </div>

      {/* Category chip strip — only when 2+ categories exist */}
      {showCategoryStrip && (
        <div className="tag-filter__category-strip" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`tag-filter__category-chip${selectedCategoryId === null ? ' tag-filter__category-chip--active' : ''}`}
            onClick={() => onCategoryChange(null)}
          >
            All
          </button>
          {availableCategories.map(({ category }) => (
            <button
              key={category.id}
              type="button"
              className={`tag-filter__category-chip${selectedCategoryId === category.id ? ' tag-filter__category-chip--active' : ''}`}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag chip strip */}
      {displayedTags.length > 0 ? (
        <div className="tag-filter__tag-strip" role="group" aria-label="Select tags to filter by">
          {displayedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`tag-filter__tag-chip${activeTagFilters.has(tag.id) ? ' tag-filter__tag-chip--active' : ''}`}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
              onClick={() => onToggleTag(tag.id)}
              aria-pressed={activeTagFilters.has(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="tag-filter__empty">No tags match</p>
      )}
    </div>
  );
}

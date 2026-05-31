import type { ChangeEvent } from 'react';

export interface WorkTypeFilters {
  search: string;
  unitFilter: string[];
  sortOrder: 'az' | 'za' | 'updated';
  /** Reserved for Tier 2 tag filter — empty = no filter applied. */
  tagFilter: string[];
}

export const DEFAULT_WORK_TYPE_FILTERS: WorkTypeFilters = {
  search: '',
  unitFilter: [],
  sortOrder: 'az',
  tagFilter: [],
};

export interface WorkUnitOption {
  id: string;
  label: string;
  count: number;
}

interface WorkTypeFilterBarProps {
  filters: WorkTypeFilters;
  onChange: (next: WorkTypeFilters) => void;
  unitOptions: WorkUnitOption[];
  totalCount: number;
  filteredCount: number;
}

export function WorkTypeFilterBar({
  filters,
  onChange,
  unitOptions,
  totalCount,
  filteredCount,
}: WorkTypeFilterBarProps) {
  const isFiltered =
    filters.search.trim() !== '' ||
    filters.unitFilter.length > 0 ||
    filters.tagFilter.length > 0;

  const showCount = isFiltered && filteredCount < totalCount;

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, search: e.target.value });
  }

  function clearSearch() {
    onChange({ ...filters, search: '' });
  }

  function toggleUnit(id: string) {
    const next = filters.unitFilter.includes(id)
      ? filters.unitFilter.filter((u) => u !== id)
      : [...filters.unitFilter, id];
    onChange({ ...filters, unitFilter: next });
  }

  function handleSortChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange({ ...filters, sortOrder: e.target.value as WorkTypeFilters['sortOrder'] });
  }

  function clearAll() {
    onChange(DEFAULT_WORK_TYPE_FILTERS);
  }

  return (
    <div className="wt-filter-bar">
      <div className="wt-filter-bar__search-row">
        <div className="wt-filter-bar__search-wrap">
          <input
            type="search"
            className="input wt-filter-bar__search-input"
            placeholder="Search work types…"
            value={filters.search}
            onChange={handleSearchChange}
            aria-label="Search work types"
          />
          {filters.search !== '' && (
            <button
              type="button"
              className="wt-filter-bar__clear-search"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="wt-filter-bar__controls-row">
        <select
          className="input wt-filter-bar__sort"
          value={filters.sortOrder}
          onChange={handleSortChange}
          aria-label="Sort order"
        >
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="updated">Recently updated</option>
        </select>

        {unitOptions.length > 1 && (
          <div className="wt-filter-bar__unit-chips" role="group" aria-label="Filter by unit">
            {unitOptions.map((u) => {
              const active = filters.unitFilter.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`wt-filter-bar__chip${active ? ' wt-filter-bar__chip--active' : ''}`}
                  onClick={() => toggleUnit(u.id)}
                  aria-pressed={active}
                >
                  {u.label}
                  <span className="wt-filter-bar__chip-count">{u.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(isFiltered || showCount) && (
        <div className="wt-filter-bar__meta-row">
          {showCount && (
            <span className="wt-filter-bar__count">
              {filteredCount} of {totalCount}
            </span>
          )}
          {isFiltered && (
            <button type="button" className="wt-filter-bar__clear-all" onClick={clearAll}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import type { ChangeEvent } from 'react';
import type { WorkTypeFilters, WorkUnitOption, TagOption } from './WorkTypeFilterBar';
import { ExportIcon, ImportIcon, PlusIcon } from '../../components/icons';

interface WorkTypeToolbarProps {
  filters: WorkTypeFilters;
  onChange: (next: WorkTypeFilters) => void;
  unitOptions: WorkUnitOption[];
  tagOptions: TagOption[];
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function WorkTypeToolbar({
  filters,
  onChange,
  unitOptions,
  tagOptions,
  onAdd,
  onExport,
  onImport,
}: WorkTypeToolbarProps) {
  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, search: e.target.value });
  }

  function toggleUnit(id: string) {
    const next = filters.unitFilter.includes(id)
      ? filters.unitFilter.filter((u) => u !== id)
      : [...filters.unitFilter, id];
    onChange({ ...filters, unitFilter: next });
  }

  function toggleTag(id: string) {
    const next = filters.tagFilter.includes(id)
      ? filters.tagFilter.filter((t) => t !== id)
      : [...filters.tagFilter, id];
    onChange({ ...filters, tagFilter: next });
  }

  const regularTags = tagOptions.filter((t) => !t.isSkill);
  const skillTags   = tagOptions.filter((t) => t.isSkill);
  const allTags     = [...regularTags, ...skillTags];

  return (
    <div className="wt-toolbar">
      <div className="wt-toolbar__left">
        {/* Search */}
        <div className="wt-toolbar__search-wrap">
          <svg className="wt-toolbar__search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="input wt-toolbar__search-input"
            placeholder="Search…"
            value={filters.search}
            onChange={handleSearchChange}
            aria-label="Search work types"
          />
          {filters.search !== '' && (
            <button
              type="button"
              className="wt-toolbar__clear-search"
              onClick={() => onChange({ ...filters, search: '' })}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Unit chips */}
        {unitOptions.length > 1 && (
          <div className="wt-toolbar__chips" role="group" aria-label="Filter by unit">
            {unitOptions.map((u) => {
              const active = filters.unitFilter.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`wt-toolbar__chip${active ? ' wt-toolbar__chip--active' : ''}`}
                  onClick={() => toggleUnit(u.id)}
                  aria-pressed={active}
                >
                  {u.label}
                  <span className="wt-toolbar__chip-count">{u.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tag chips */}
        {allTags.length > 0 && (
          <>
            {unitOptions.length > 1 && <div className="wt-toolbar__divider" aria-hidden />}
            <div className="wt-toolbar__chips" role="group" aria-label="Filter by tag">
              {allTags.map((t) => {
                const active = filters.tagFilter.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`wt-toolbar__tag-chip${active ? ' wt-toolbar__tag-chip--active' : ''}`}
                    style={{ '--tag-color': t.color } as React.CSSProperties}
                    onClick={() => toggleTag(t.id)}
                    aria-pressed={active}
                  >
                    {t.name}
                    <span className="wt-toolbar__chip-count">{t.count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="wt-toolbar__right">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onImport}
          aria-label="Import CSV"
        >
          <ImportIcon className="wt-toolbar__btn-icon" />
          Import
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onExport}
          aria-label="Export CSV"
        >
          <ExportIcon className="wt-toolbar__btn-icon" />
          Export
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onAdd}
        >
          <PlusIcon className="wt-toolbar__btn-icon" />
          Add work type
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { WorkType } from '../../lib/types';
import { resolveWorkUnitLabel } from '../../lib/types';
import type { Tag } from '../../lib/tags';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { TagPill } from '../../components/TagPill';
import type { WorkTypeSelectionState } from './hooks/useWorkTypeSelection';

type SortCol = 'name' | 'unit' | 'assembly' | 'dismantle';
type SortDir = 'asc' | 'desc';

interface WorkTypeTableProps {
  rows: WorkType[];
  usageByWorkTypeId: Map<string, number>;
  tagById: Map<string, Tag>;
  selection: WorkTypeSelectionState;
  editingId: string | null;
  onEdit: (wt: WorkType) => void;
  onDelete: (wt: WorkType) => void;
}

function sortRows(rows: WorkType[], col: SortCol, dir: SortDir): WorkType[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (col === 'name')      cmp = a.title.localeCompare(b.title);
    else if (col === 'unit') cmp = a.workUnit.localeCompare(b.workUnit);
    else if (col === 'assembly')  cmp = a.assemblyRate - b.assemblyRate;
    else if (col === 'dismantle') cmp = a.dismantleRate - b.dismantleRate;
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function WorkTypeTable({
  rows,
  usageByWorkTypeId,
  tagById,
  selection,
  editingId,
  onEdit,
  onDelete,
}: WorkTypeTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleHeaderClick(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedRows = sortRows(rows, sortCol, sortDir);
  const someVisibleSelected = sortedRows.some((wt) => selection.selectedIds.includes(wt.id));
  const allVisibleSelected =
    sortedRows.length > 0 && sortedRows.every((wt) => selection.selectedIds.includes(wt.id));
  const isIndeterminate = someVisibleSelected && !allVisibleSelected;

  // The :indeterminate CSS pseudo-class requires the JS property to be set via ref
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  function toggleSelectAll() {
    if (allVisibleSelected) {
      sortedRows.forEach((wt) => {
        if (selection.selectedIds.includes(wt.id)) selection.toggleSelected(wt.id);
      });
    } else {
      sortedRows.forEach((wt) => {
        if (!selection.selectedIds.includes(wt.id)) selection.toggleSelected(wt.id);
      });
    }
  }

  function sortIndicator(col: SortCol) {
    if (col !== sortCol) {
      return (
        <svg className="wt-table__sort-icon wt-table__sort-icon--idle" aria-hidden viewBox="0 0 8 12" fill="none">
          <path d="M4 1L1.5 4.5H6.5L4 1Z" fill="currentColor" opacity="0.35" />
          <path d="M4 11L6.5 7.5H1.5L4 11Z" fill="currentColor" opacity="0.35" />
        </svg>
      );
    }
    return sortDir === 'asc' ? (
      <svg className="wt-table__sort-icon" aria-hidden viewBox="0 0 8 6" fill="none">
        <path d="M4 0L7.5 5.5H0.5L4 0Z" fill="currentColor" />
      </svg>
    ) : (
      <svg className="wt-table__sort-icon" aria-hidden viewBox="0 0 8 6" fill="none">
        <path d="M4 6L0.5 0.5H7.5L4 6Z" fill="currentColor" />
      </svg>
    );
  }

  function thClass(col: SortCol, align: 'left' | 'right' | 'center' = 'left') {
    return [
      'wt-table__th',
      `wt-table__th--${align}`,
      'wt-table__th--sortable',
      col === sortCol ? 'wt-table__th--sorted' : '',
    ].filter(Boolean).join(' ');
  }

  return (
    <div className="swt-desktop__table-wrap">
      <table className="wt-table" aria-label="Work types">
        <colgroup>
          <col style={{ width: 44 }} />
          <col />
          <col style={{ width: 72 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 84 }} />
        </colgroup>
        <thead className="wt-table__thead">
          <tr>
            <th className="wt-table__th wt-table__th--center">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="wt-table__checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th
              className={thClass('name', 'left')}
              onClick={() => handleHeaderClick('name')}
              aria-sort={sortCol === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Name {sortIndicator('name')}
            </th>
            <th
              className={thClass('unit', 'center')}
              onClick={() => handleHeaderClick('unit')}
              aria-sort={sortCol === 'unit' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Unit {sortIndicator('unit')}
            </th>
            <th
              className={thClass('assembly', 'right')}
              onClick={() => handleHeaderClick('assembly')}
              aria-sort={sortCol === 'assembly' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Assembly {sortIndicator('assembly')}
            </th>
            <th
              className={thClass('dismantle', 'right')}
              onClick={() => handleHeaderClick('dismantle')}
              aria-sort={sortCol === 'dismantle' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Dismantle {sortIndicator('dismantle')}
            </th>
            <th className="wt-table__th wt-table__th--left">Tags</th>
            <th className="wt-table__th wt-table__th--center">In Use</th>
            <th className="wt-table__th" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((wt) => {
            const usageCount = usageByWorkTypeId.get(wt.id) ?? 0;
            const isSelected = selection.selectedIds.includes(wt.id);
            const isEditing  = wt.id === editingId;
            const unit       = resolveWorkUnitLabel(wt.workUnit);

            const rowClass = [
              'wt-table__tr',
              isSelected ? 'wt-table__tr--selected' : '',
              isEditing  ? 'wt-table__tr--editing'  : '',
            ].filter(Boolean).join(' ');

            return (
              <tr key={wt.id} className={rowClass}>
                {/* Checkbox */}
                <td className="wt-table__td wt-table__td--center">
                  <input
                    type="checkbox"
                    className="wt-table__checkbox"
                    checked={isSelected}
                    onChange={() => selection.toggleSelected(wt.id)}
                    aria-label={`Select ${wt.title}`}
                  />
                </td>

                {/* Name */}
                <td className="wt-table__td">
                  <button
                    type="button"
                    className="wt-table__name"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    onClick={() => onEdit(wt)}
                  >
                    {wt.title}
                    {usageCount > 0 && (
                      <span className="wt-table__usage-badge">{usageCount} {usageCount === 1 ? 'task' : 'tasks'}</span>
                    )}
                  </button>
                </td>

                {/* Unit */}
                <td className="wt-table__td wt-table__td--center">
                  <span className="wt-table__unit">{unit}</span>
                </td>

                {/* Assembly */}
                <td className="wt-table__td wt-table__td--right">
                  {wt.assemblyRate > 0 ? (
                    <span className="wt-table__rate">
                      {wt.assemblyRate % 1 === 0 ? wt.assemblyRate.toFixed(1) : wt.assemblyRate}
                      <span className="wt-table__rate-unit">{unit}/ph</span>
                    </span>
                  ) : (
                    <span className="wt-table__empty-cell">—</span>
                  )}
                </td>

                {/* Dismantle */}
                <td className="wt-table__td wt-table__td--right">
                  {wt.dismantleRate > 0 ? (
                    <span className="wt-table__rate">
                      {wt.dismantleRate % 1 === 0 ? wt.dismantleRate.toFixed(1) : wt.dismantleRate}
                      <span className="wt-table__rate-unit">{unit}/ph</span>
                    </span>
                  ) : (
                    <span className="wt-table__empty-cell">—</span>
                  )}
                </td>

                {/* Tags */}
                <td className="wt-table__td">
                  <div className="wt-table__tags">
                    {(wt.tagIds ?? []).map((id) => {
                      const tag = tagById.get(id);
                      return tag ? <TagPill key={id} tag={tag} /> : null;
                    })}
                    {wt.skillTagId && tagById.get(wt.skillTagId) && (
                      <TagPill tag={tagById.get(wt.skillTagId)!} />
                    )}
                  </div>
                </td>

                {/* In Use */}
                <td className="wt-table__td wt-table__td--center">
                  {usageCount > 0 ? (
                    <span>{usageCount}</span>
                  ) : (
                    <span className="wt-table__empty-cell">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="wt-table__td wt-table__td--center">
                  <div className="wt-table__actions">
                    <button
                      type="button"
                      className="wt-table__action-btn"
                      onClick={() => onEdit(wt)}
                      aria-label={`Edit ${wt.title}`}
                    >
                      <PencilIcon className="wt-table__action-icon" />
                    </button>
                    <button
                      type="button"
                      className="wt-table__action-btn wt-table__action-btn--danger"
                      onClick={() => onDelete(wt)}
                      aria-label={`Delete ${wt.title}`}
                    >
                      <TrashIcon className="wt-table__action-icon" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bulk bar */}
      {selection.selectedIds.length > 0 && (
        <div className="wt-bulk-bar">
          <span className="wt-bulk-bar__count">{selection.selectedIds.length} selected</span>
          <button
            type="button"
            className="wt-bulk-bar__select-all"
            onClick={toggleSelectAll}
          >
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </button>
          <div className="wt-bulk-bar__spacer" />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ color: '#e0e0e8', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => {
              sortedRows.forEach((wt) => {
                if (selection.selectedIds.includes(wt.id)) selection.toggleSelected(wt.id);
              });
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={selection.openBulkConfirm}
          >
            Delete ({selection.selectedIds.length})
          </button>
        </div>
      )}
    </div>
  );
}

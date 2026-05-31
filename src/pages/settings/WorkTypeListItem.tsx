import type { WorkType } from '../../lib/types';
import { resolveWorkUnitLabel } from '../../lib/types';
import type { Tag } from '../../lib/tags';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { TagPill } from '../../components/TagPill';

interface WorkTypeListItemProps {
  wt: WorkType;
  usageCount: number;
  tagById: Map<string, Tag>;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (wt: WorkType) => void;
  onDelete: (wt: WorkType) => void;
}

export function WorkTypeListItem({
  wt,
  usageCount,
  tagById,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
}: WorkTypeListItemProps) {
  const skillTag = wt.skillTagId ? tagById.get(wt.skillTagId) : null;

  return (
    <div
      className={`settings-view__list-item${selectionMode ? ' settings-view__list-item--selectable' : ''}`}
    >
      {selectionMode && (
        <input
          type="checkbox"
          className="wt-row-checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(wt.id)}
          aria-label={`Select ${wt.title}`}
        />
      )}
      <button
        className={`settings-view__row${isSelected ? ' settings-view__row--selected' : ''}`}
        onClick={() => onEdit(wt)}
      >
        <div className="settings-view__template-info">
          <span className="settings-view__row-label">
            {wt.title}
            {usageCount > 0 && (
              <span className="wt-usage-badge">
                {usageCount} {usageCount === 1 ? 'task' : 'tasks'}
              </span>
            )}
          </span>
          <span className="settings-view__row-detail">
            {resolveWorkUnitLabel(wt.workUnit)} · Assembly {wt.assemblyRate} · Dismantle{' '}
            {wt.dismantleRate} {resolveWorkUnitLabel(wt.workUnit)}/person-hr
          </span>
          {wt.tagIds && wt.tagIds.length > 0 && (
            <span className="settings-view__row-tags">
              {wt.tagIds.map((id) => {
                const tag = tagById.get(id);
                return tag ? <TagPill key={id} tag={tag} /> : null;
              })}
            </span>
          )}
          {skillTag && (
            <span className="settings-view__row-detail" style={{ fontSize: 12 }}>
              Skill: <TagPill tag={skillTag} />
            </span>
          )}
        </div>
      </button>
      {!selectionMode && (
        <div className="settings-view__list-item-actions">
          <IconButton
            icon={<PencilIcon className="settings-detail__icon" />}
            ariaLabel={`Edit work type ${wt.title}`}
            onClick={() => onEdit(wt)}
            variant="ghost"
            className="icon-btn--edit"
          />
          <IconButton
            icon={<TrashIcon className="settings-detail__icon" />}
            ariaLabel={`Delete work type ${wt.title}`}
            onClick={() => onDelete(wt)}
            variant="ghost"
            className="icon-btn--danger"
          />
        </div>
      )}
    </div>
  );
}

/**
 * WorkTypeFormSheet — ActionSheet for creating and editing work types.
 */

import { useState, useEffect } from 'react';
import {
  resolveWorkUnitLabel,
  WorkType,
} from '../lib/types';
import { createWorkType, updateWorkTypeFields } from '../lib/stores/work-type-store';
import { useSelectableWorkUnits } from '../lib/hooks/useSelectableWorkUnits';
import { ActionSheet } from './ActionSheet';
import { WorkUnitPillGroup } from './WorkUnitPillGroup';
import { TagPillGroup } from './TagPillGroup';
import { TagPickerSheet } from './TagPickerSheet';
import { useTagStore } from '../lib/stores/tag-store';

interface WorkTypeFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workType?: WorkType | null;
  onDelete?: () => void;
}

export function WorkTypeFormSheet({
  isOpen,
  onClose,
  workType = null,
  onDelete,
}: WorkTypeFormSheetProps) {
  const isEdit = !!workType;
  const { selectableUnits, defaultUnitId } = useSelectableWorkUnits(workType?.workUnit ?? null);
  useTagStore(); // subscribe for tag data

  const [title, setTitle] = useState('');
  const [workUnit, setWorkUnit] = useState(defaultUnitId);
  const [assemblyRate, setAssemblyRate] = useState('');
  const [dismantleRate, setDismantleRate] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (workType) {
        setTitle(workType.title);
        setWorkUnit(workType.workUnit);
        setAssemblyRate(String(workType.assemblyRate));
        setDismantleRate(String(workType.dismantleRate));
        setTagIds(workType.tagIds ?? []);
      } else {
        setTitle('');
        setWorkUnit(defaultUnitId);
        setAssemblyRate('');
        setDismantleRate('');
        setTagIds([]);
      }
    }
  }, [defaultUnitId, isOpen, workType]);

  const parsedAssemblyRate = parseFloat(assemblyRate) || 0;
  const parsedDismantleRate = parseFloat(dismantleRate) || 0;
  const hasAtLeastOneRate = parsedAssemblyRate > 0 || parsedDismantleRate > 0;
  const canSave = title.trim().length > 0 && hasAtLeastOneRate && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit && workType) {
        await updateWorkTypeFields(workType.id, {
          title: title.trim(),
          workUnit,
          assemblyRate: parsedAssemblyRate,
          dismantleRate: parsedDismantleRate,
          tagIds,
        });
      } else {
        await createWorkType({
          title: title.trim(),
          workUnit,
          assemblyRate: parsedAssemblyRate,
          dismantleRate: parsedDismantleRate,
          tagIds,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <ActionSheet isOpen={isOpen} title={isEdit ? 'Edit Work Type' : 'New Work Type'} onClose={onClose}>
      <div className="create-task-sheet__form">
        {error && (
          <div className="calculator__provenance-warning" style={{ padding: '8px 0', color: 'var(--color-danger, #dc2626)' }}>
            {error}
          </div>
        )}

        {/* Title */}
        <input
          type="text"
          className="input"
          placeholder="Work type name (e.g. Carpet Tiles)..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => {
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
        />

        {/* Work Unit */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Unit</label>
          <WorkUnitPillGroup
            units={selectableUnits}
            value={workUnit}
            onChange={setWorkUnit}
            ariaLabel="Unit"
          />
        </div>

        {/* Assembly Rate */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Assembly rate</label>
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={assemblyRate}
              onChange={(e) => setAssemblyRate(e.target.value)}
              placeholder="0"
              style={{ width: `${Math.max(String(assemblyRate || '0').length, 1)}ch` }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {resolveWorkUnitLabel(workUnit)}/person-hr
            </span>
          </div>
        </div>

        {/* Dismantle Rate */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Dismantle rate</label>
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={dismantleRate}
              onChange={(e) => setDismantleRate(e.target.value)}
              placeholder="0"
              style={{ width: `${Math.max(String(dismantleRate || '0').length, 1)}ch` }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {resolveWorkUnitLabel(workUnit)}/person-hr
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Tags</label>
          <TagPillGroup
            tagIds={tagIds}
            onRemoveTag={(id) => setTagIds(tagIds.filter((t) => t !== id))}
            onAddTag={() => setShowTagPicker(true)}
          />
        </div>

        {/* Actions */}
        <div className="action-sheet__actions">
          {isEdit && onDelete && (
            <button type="button" className="btn btn--danger btn--lg" onClick={onDelete}>
              Delete
            </button>
          )}
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>

    <TagPickerSheet
      isOpen={showTagPicker}
      onClose={() => setShowTagPicker(false)}
      selectedTagIds={tagIds}
      onChange={setTagIds}
      title="Assign Tags to Work Type"
    />
    </>
  );
}

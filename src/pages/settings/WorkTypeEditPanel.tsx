import { useState, useEffect } from 'react';
import type { WorkType } from '../../lib/types';
import { resolveWorkUnitLabel } from '../../lib/types';
import { createWorkType, updateWorkTypeFields } from '../../lib/stores/work-type-store';
import { useSelectableWorkUnits } from '../../lib/hooks/useSelectableWorkUnits';
import { useTagStore, getSnapshot } from '../../lib/stores/tag-store';
import { WorkUnitPillGroup } from '../../components/WorkUnitPillGroup';
import { TagPillGroup } from '../../components/TagPillGroup';
import { TagPickerSheet } from '../../components/TagPickerSheet';

interface WorkTypeEditPanelProps {
  workType: WorkType | null; // null = create mode
  onClose: () => void;
  onDelete?: () => void;
}

export function WorkTypeEditPanel({ workType, onClose, onDelete }: WorkTypeEditPanelProps) {
  const isEdit = !!workType;
  const { selectableUnits, defaultUnitId } = useSelectableWorkUnits(workType?.workUnit ?? null);
  useTagStore();

  const [title, setTitle]               = useState('');
  const [workUnit, setWorkUnit]         = useState(defaultUnitId);
  const [assemblyRate, setAssemblyRate] = useState('');
  const [dismantleRate, setDismantleRate] = useState('');
  const [tagIds, setTagIds]             = useState<string[]>([]);
  const [skillTagId, setSkillTagId]     = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const skillTags = getSnapshot().tags.filter((t) => t.skillTag);

  useEffect(() => {
    setError(null);
    if (workType) {
      setTitle(workType.title);
      setWorkUnit(workType.workUnit);
      setAssemblyRate(String(workType.assemblyRate));
      setDismantleRate(String(workType.dismantleRate));
      setTagIds(workType.tagIds ?? []);
      setSkillTagId(workType.skillTagId ?? null);
    } else {
      setTitle('');
      setWorkUnit(defaultUnitId);
      setAssemblyRate('');
      setDismantleRate('');
      setTagIds([]);
      setSkillTagId(null);
    }
  }, [defaultUnitId, workType]);

  const parsedAssemblyRate  = parseFloat(assemblyRate)  || 0;
  const parsedDismantleRate = parseFloat(dismantleRate) || 0;
  const hasAtLeastOneRate   = parsedAssemblyRate > 0 || parsedDismantleRate > 0;
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
          skillTagId,
        });
      } else {
        await createWorkType({
          title: title.trim(),
          workUnit,
          assemblyRate: parsedAssemblyRate,
          dismantleRate: parsedDismantleRate,
          tagIds,
          skillTagId,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const unitLabel = resolveWorkUnitLabel(workUnit);

  return (
    <>
      <aside className="wt-edit-panel" aria-label={isEdit ? 'Edit work type' : 'New work type'}>
        <div className="wt-edit-panel__header">
          <h2 className="wt-edit-panel__title">
            {isEdit ? 'Edit Work Type' : 'New Work Type'}
          </h2>
          <button
            type="button"
            className="wt-edit-panel__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        <div className="wt-edit-panel__body">
          {error && <p className="wt-edit-panel__error">{error}</p>}

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Carpet Tiles"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Work Unit</label>
            <WorkUnitPillGroup
              units={selectableUnits}
              value={workUnit}
              onChange={setWorkUnit}
              ariaLabel="Unit"
            />
          </div>

          <div className="wt-edit-panel__rates-row">
            <div className="wt-edit-panel__field">
              <label className="wt-edit-panel__label">Assembly</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={assemblyRate}
                  onChange={(e) => setAssemblyRate(e.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(assemblyRate || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden>
                  {unitLabel}/ph
                </span>
              </div>
            </div>

            <div className="wt-edit-panel__field">
              <label className="wt-edit-panel__label">Dismantle</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={dismantleRate}
                  onChange={(e) => setDismantleRate(e.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(dismantleRate || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden>
                  {unitLabel}/ph
                </span>
              </div>
            </div>
          </div>

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Tags</label>
            <TagPillGroup
              tagIds={tagIds}
              onRemoveTag={(id) => setTagIds(tagIds.filter((t) => t !== id))}
              onAddTag={() => setShowTagPicker(true)}
            />
          </div>

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Skill</label>
            {skillTags.length === 0 ? (
              <p className="wt-edit-panel__hint">
                No skill tags — mark a tag as a skill in Tags settings.
              </p>
            ) : (
              <select
                className="input"
                value={skillTagId ?? ''}
                onChange={(e) => setSkillTagId(e.target.value || null)}
              >
                <option value="">None</option>
                {skillTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="wt-edit-panel__footer">
          {isEdit && onDelete && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--color-recording, #dc2626)' }}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <div className="wt-edit-panel__footer-right">
            <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => { void handleSave(); }}
              disabled={!canSave}
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </aside>

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

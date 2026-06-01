import { useState, useEffect } from 'react';
import type { WorkType } from '../../lib/types';
import { resolveWorkUnitLabel } from '../../lib/types';
import { createWorkType, updateWorkTypeFields } from '../../lib/stores/work-type-store';
import { useSelectableWorkUnits } from '../../lib/hooks/useSelectableWorkUnits';
import { useTagStore, getSnapshot } from '../../lib/stores/tag-store';
import { XIcon, TrashIcon } from '../../components/icons';

interface WorkTypeEditPanelProps {
  workType: WorkType | null; // null = create mode
  onClose: () => void;
  onDelete?: () => void;
}

export function WorkTypeEditPanel({ workType, onClose, onDelete }: WorkTypeEditPanelProps) {
  const isEdit = !!workType;
  const { selectableUnits, defaultUnitId } = useSelectableWorkUnits(workType?.workUnit ?? null);
  useTagStore();

  const [title, setTitle]                   = useState('');
  const [workUnit, setWorkUnit]             = useState(defaultUnitId);
  const [assemblyRate, setAssemblyRate]     = useState('');
  const [dismantleRate, setDismantleRate]   = useState('');
  const [tagIds, setTagIds]                 = useState<string[]>([]);
  const [skillTagId, setSkillTagId]         = useState<string | null>(null);
  const [isSaving, setIsSaving]             = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const snap = getSnapshot();
  const allTags  = snap.tags.filter((t) => !t.skillTag);
  const skillTags = snap.tags.filter((t) => t.skillTag);

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

  const toggleTag = (id: string) =>
    setTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);

  return (
    <>
      {/* Backdrop */}
      <div className="wt-edit-panel__backdrop" onClick={onClose} aria-hidden />

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
            <XIcon className="wt-edit-panel__close-icon" />
          </button>
        </div>

        <div className="wt-edit-panel__body">
          {error && <p className="wt-edit-panel__error">{error}</p>}

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Name</label>
            <input
              type="text"
              className="wt-edit-panel__input"
              placeholder="e.g. Carpet Tiles"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Work Unit</label>
            <select
              className="wt-edit-panel__input wt-edit-panel__input--select"
              value={workUnit}
              onChange={(e) => setWorkUnit(e.target.value)}
            >
              {selectableUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          <div className="wt-edit-panel__rates-row">
            <div className="wt-edit-panel__field">
              <label className="wt-edit-panel__label">Assembly Rate</label>
              <div className="wt-edit-panel__rate-wrap">
                <input
                  inputMode="decimal"
                  className="wt-edit-panel__rate-input"
                  value={assemblyRate}
                  onChange={(e) => setAssemblyRate(e.target.value)}
                  placeholder="0"
                />
                <span className="wt-edit-panel__rate-unit" aria-hidden>
                  {resolveWorkUnitLabel(workUnit)}/ph
                </span>
              </div>
            </div>

            <div className="wt-edit-panel__field">
              <label className="wt-edit-panel__label">Dismantle Rate</label>
              <div className="wt-edit-panel__rate-wrap">
                <input
                  inputMode="decimal"
                  className="wt-edit-panel__rate-input"
                  value={dismantleRate}
                  onChange={(e) => setDismantleRate(e.target.value)}
                  placeholder="0"
                />
                <span className="wt-edit-panel__rate-unit" aria-hidden>
                  {resolveWorkUnitLabel(workUnit)}/ph
                </span>
              </div>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="wt-edit-panel__field">
              <label className="wt-edit-panel__label">Tags</label>
              <div className="wt-edit-panel__tag-grid">
                {allTags.map((tag) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`wt-edit-panel__tag-pill${active ? ' wt-edit-panel__tag-pill--active' : ''}`}
                      style={{ '--tag-color': tag.color } as React.CSSProperties}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="wt-edit-panel__field">
            <label className="wt-edit-panel__label">Skill</label>
            {skillTags.length === 0 ? (
              <p className="wt-edit-panel__hint">
                No skill tags — mark a tag as a skill in Tags settings.
              </p>
            ) : (
              <select
                className="wt-edit-panel__input wt-edit-panel__input--select"
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
              className="wt-edit-panel__delete-btn"
              onClick={onDelete}
            >
              <TrashIcon className="wt-edit-panel__delete-icon" />
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
    </>
  );
}

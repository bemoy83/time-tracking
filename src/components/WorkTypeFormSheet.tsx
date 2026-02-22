/**
 * WorkTypeFormSheet — ActionSheet for creating and editing work types.
 */

import { useState, useEffect } from 'react';
import {
  WorkUnit,
  WORK_UNIT_LABELS,
  BuildPhase,
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  WorkType,
} from '../lib/types';
import { createWorkType, updateWorkTypeFields } from '../lib/stores/work-type-store';
import { ActionSheet } from './ActionSheet';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

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

  const [title, setTitle] = useState('');
  const [workUnit, setWorkUnit] = useState<WorkUnit>('m2');
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('build-up');
  const [expectedProductivity, setExpectedProductivity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (workType) {
        setTitle(workType.title);
        setWorkUnit(workType.workUnit);
        setBuildPhase(workType.buildPhase);
        setExpectedProductivity(String(workType.expectedProductivity));
      } else {
        setTitle('');
        setWorkUnit('m2');
        setBuildPhase('build-up');
        setExpectedProductivity('');
      }
    }
  }, [isOpen, workType]);

  const parsedRate = parseFloat(expectedProductivity);
  const canSave = title.trim().length > 0 && !isNaN(parsedRate) && parsedRate > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit && workType) {
        await updateWorkTypeFields(workType.id, {
          title: title.trim(),
          workUnit,
          buildPhase,
          expectedProductivity: parsedRate,
        });
      } else {
        await createWorkType({
          title: title.trim(),
          workUnit,
          buildPhase,
          expectedProductivity: parsedRate,
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
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Unit">
            {WORK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={workUnit === u}
                className={`task-work-quantity__unit-pill${workUnit === u ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setWorkUnit(u)}
              >
                {WORK_UNIT_LABELS[u]}
              </button>
            ))}
          </div>
        </div>

        {/* Build Phase */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Build Phase</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Build phase">
            {BUILD_PHASES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={buildPhase === p}
                className={`task-work-quantity__unit-pill${buildPhase === p ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setBuildPhase(p)}
              >
                {BUILD_PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Expected Productivity */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Expected Productivity</label>
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={expectedProductivity}
              onChange={(e) => setExpectedProductivity(e.target.value)}
              placeholder="0"
              style={{ width: `${Math.max(String(expectedProductivity || '0').length, 1)}ch` }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {WORK_UNIT_LABELS[workUnit]}/person-hr
            </span>
          </div>
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
  );
}

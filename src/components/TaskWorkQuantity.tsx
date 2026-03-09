/**
 * TaskWorkQuantity component.
 * Displays work quantity summary; opens ActionSheet to edit.
 * Supports WorkType selection for attribution/measurability.
 * Uses ExpandableSection for the outer toggle.
 */

import { useState } from 'react';
import { useTask, updateTaskFields } from '../lib/stores/task-store';
import { useSubtaskTimeRollupMode } from '../lib/stores/subtask-time-rollup-settings';
import { getWorkTypeById, useWorkTypeStore } from '../lib/stores/work-type-store';
import {
  WorkUnit,
  WORK_UNITS,
  WORK_UNIT_LABELS,
  formatWorkQuantity,
} from '../lib/types';
import type { Task } from '../lib/types';
import { ExpandableSection } from './ExpandableSection';
import { ActionSheet } from './ActionSheet';
import { WorkTypePicker } from './WorkTypePicker';
import { RulerIcon, PencilIcon } from './icons';


interface TaskWorkQuantityProps {
  taskId: string;
}

export function TaskWorkQuantity({ taskId }: TaskWorkQuantityProps) {
  const task = useTask(taskId);
  const subtaskRollupMode = useSubtaskTimeRollupMode();
  const { workTypes } = useWorkTypeStore();
  const [showSheet, setShowSheet] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WorkUnit>('m2');
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string | null>(null);

  const hasWork = task?.workQuantity != null && task?.workUnit != null;
  const selectedWorkType = selectedWorkTypeId ? getWorkTypeById(selectedWorkTypeId) : null;

  // Filter work types by task's existing unit, or show all if no unit set
  const filteredWorkTypes = task?.workUnit
    ? workTypes.filter((wt) => wt.workUnit === task.workUnit)
    : workTypes;

  const handleOpen = () => {
    if (task?.workQuantity != null && task?.workUnit != null) {
      setQuantity(String(task.workQuantity));
      setUnit(task.workUnit);
    } else {
      setQuantity('');
      setUnit('m2');
    }
    setSelectedWorkTypeId(task?.workTypeId ?? null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    const parsed = parseFloat(quantity);
    if (isNaN(parsed) || parsed <= 0) return;

    const patch: Partial<Pick<Task, 'workQuantity' | 'workUnit' | 'workTypeId' | 'targetProductivity'>> = {
      workQuantity: parsed,
      workUnit: unit,
    };

    if (selectedWorkTypeId) {
      const wt = getWorkTypeById(selectedWorkTypeId);
      if (!wt) return;
      patch.workTypeId = wt.id;
      patch.targetProductivity = wt.buildUpRate || wt.tearDownRate;
      patch.workUnit = wt.workUnit;
    } else {
      patch.workTypeId = null;
      patch.targetProductivity = null;
    }

    await updateTaskFields(taskId, patch);
    setShowSheet(false);
  };

  const handleClear = async () => {
    await updateTaskFields(taskId, {
      workQuantity: null,
      workUnit: null,
      workTypeId: null,
      targetProductivity: null,
    });
    setShowSheet(false);
  };

  const handleWorkTypeChange = (id: string | null) => {
    setSelectedWorkTypeId(id);
    const wt = id ? getWorkTypeById(id) : null;
    if (wt) {
      setUnit(wt.workUnit);
    }
  };

  if (task?.parentId != null && subtaskRollupMode === 'simple') {
    return null;
  }

  // Section summary: "120 m² · Carpet Tiles" or "120 m²"
  const summaryLabel = (() => {
    if (!hasWork) return undefined;
    const base = formatWorkQuantity(task.workQuantity!, task.workUnit!);
    if (task.workTypeId) {
      const wt = getWorkTypeById(task.workTypeId);
      if (wt) return `${base} · ${wt.title}`;
    }
    return base;
  })();

  return (
    <>
      <ExpandableSection
        label="WORK"
        icon={<RulerIcon className="task-work-quantity__icon" />}
        defaultOpen={false}
        sectionSummary={summaryLabel}
      >
        <div className="task-work-quantity__content">
          <span className="task-work-quantity__section-label section-heading">WORK QUANTITY</span>

          {hasWork ? (
            <div className="task-work-quantity__summary">
              <span className="task-work-quantity__value">
                {formatWorkQuantity(task.workQuantity!, task.workUnit!)}
              </span>
              <button
                type="button"
                className="task-work-quantity__edit-btn"
                onClick={handleOpen}
                aria-label="Edit work quantity"
              >
                <PencilIcon className="task-work-quantity__icon" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="task-work-quantity__set-btn"
              onClick={handleOpen}
            >
              + Set work quantity
            </button>
          )}
        </div>
      </ExpandableSection>

      <ActionSheet
        isOpen={showSheet}
        title="Set Work Quantity"
        onClose={() => setShowSheet(false)}
      >
        <div className="task-work-quantity__form">
          {/* Work Type picker */}
          <WorkTypePicker
            workTypes={filteredWorkTypes}
            selectedId={selectedWorkTypeId}
            onChange={handleWorkTypeChange}
            emptyMessage={
              workTypes.length === 0
                ? 'No work types yet. Create work types in Settings.'
                : `No work types for ${WORK_UNIT_LABELS[unit]}.`
            }
            showRate
            className="task-work-quantity__section"
          />

          {/* Quantity input */}
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              autoFocus
              style={{
                width: `${Math.max(String(quantity || '0').length, 1)}ch`,
              }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {WORK_UNIT_LABELS[unit]}
            </span>
          </div>

          {/* Unit pills — hidden when WorkType selected (unit is locked) */}
          {!selectedWorkType && (
            <div
              className="task-work-quantity__unit-pills"
              role="group"
              aria-label="Unit"
            >
              {WORK_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  className={`task-work-quantity__unit-pill${unit === u ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => setUnit(u)}
                >
                  {WORK_UNIT_LABELS[u]}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="action-sheet__actions">
            {hasWork && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClear}
              >
                Clear
              </button>
            )}
            <div className="action-sheet__actions-right">
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={() => setShowSheet(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={handleSave}
                disabled={!quantity || parseFloat(quantity) <= 0}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </ActionSheet>
    </>
  );
}

/**
 * TaskWorkQuantity component.
 * Displays work quantity summary; opens ActionSheet to edit.
 * Uses ExpandableSection for the outer toggle.
 */

import { useState } from 'react';
import { useTask, updateTaskWork } from '../lib/stores/task-store';
import { WorkUnit, WORK_UNIT_LABELS, formatWorkQuantity } from '../lib/types';
import { ExpandableSection } from './ExpandableSection';
import { ActionSheet } from './ActionSheet';
import { RulerIcon, PencilIcon } from './icons';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

interface TaskWorkQuantityProps {
  taskId: string;
}

export function TaskWorkQuantity({ taskId }: TaskWorkQuantityProps) {
  const task = useTask(taskId);
  const [showSheet, setShowSheet] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WorkUnit>('m2');

  const hasWork = task?.workQuantity != null && task?.workUnit != null;

  const handleOpen = () => {
    if (task?.workQuantity != null && task?.workUnit != null) {
      setQuantity(String(task.workQuantity));
      setUnit(task.workUnit);
    } else {
      setQuantity('');
      setUnit('m2');
    }
    setShowSheet(true);
  };

  const handleSave = async () => {
    const parsed = parseFloat(quantity);
    if (isNaN(parsed) || parsed <= 0) return;
    await updateTaskWork(taskId, parsed, unit);
    setShowSheet(false);
  };

  const handleClear = async () => {
    await updateTaskWork(taskId, null, null);
    setShowSheet(false);
  };

  return (
    <>
      <ExpandableSection
        label="WORK"
        icon={<RulerIcon className="task-work-quantity__icon" />}
        defaultOpen={false}
        sectionSummary={hasWork ? formatWorkQuantity(task.workQuantity!, task.workUnit!) : undefined}
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

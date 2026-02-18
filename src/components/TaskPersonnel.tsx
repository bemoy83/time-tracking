/**
 * TaskPersonnel component.
 * Displays default crew count summary; opens ActionSheet to edit.
 * Uses ExpandableSection for the outer toggle.
 */

import { useState } from 'react';
import { pluralize } from '../lib/utils/pluralize';
import { useTask, updateTaskDefaultWorkers } from '../lib/stores/task-store';
import { ExpandableSection } from './ExpandableSection';
import { ActionSheet } from './ActionSheet';
import { PeopleIcon, ChevronUpIcon, ExpandChevronIcon } from './icons';

interface TaskPersonnelProps {
  taskId: string;
}

export function TaskPersonnel({ taskId }: TaskPersonnelProps) {
  const task = useTask(taskId);
  const [showSheet, setShowSheet] = useState(false);
  const [tempWorkers, setTempWorkers] = useState(1);

  const hasValue = task?.defaultWorkers != null;
  const currentValue = task?.defaultWorkers ?? 1;

  const handleOpen = () => {
    setTempWorkers(currentValue);
    setShowSheet(true);
  };

  const handleSave = async () => {
    await updateTaskDefaultWorkers(taskId, tempWorkers);
    setShowSheet(false);
  };

  const handleClear = async () => {
    await updateTaskDefaultWorkers(taskId, null);
    setShowSheet(false);
  };

  return (
    <>
      <ExpandableSection
        label="PERSONNEL"
        icon={<PeopleIcon className="task-personnel__icon" />}
        defaultOpen={false}
        sectionSummary={hasValue ? pluralize(currentValue, 'worker', 'workers') : undefined}
      >
        <div className="task-personnel__content">
          <span className="task-personnel__section-label section-heading">DEFAULT CREW</span>

          {hasValue ? (
            <div className="task-personnel__summary">
              <span className="task-personnel__value">{pluralize(currentValue, 'worker', 'workers')}</span>
              <button
                type="button"
                className="task-personnel__edit-btn"
                onClick={handleOpen}
                aria-label="Edit default personnel"
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="task-personnel__set-btn"
              onClick={handleOpen}
            >
              + Set default personnel
            </button>
          )}
        </div>
      </ExpandableSection>

      <ActionSheet
        isOpen={showSheet}
        title="Set Personnel"
        onClose={() => setShowSheet(false)}
      >
        <div className="task-personnel__picker">
          <button
            type="button"
            className="entry-modal__stepper-btn"
            onClick={() => setTempWorkers(Math.min(20, tempWorkers + 1))}
            disabled={tempWorkers >= 20}
            aria-label="Increase personnel"
          >
            <ChevronUpIcon className="entry-modal__stepper-chevron" />
          </button>
          <span className="task-personnel__big-value">{tempWorkers}</span>
          <span className="task-personnel__big-unit">{tempWorkers === 1 ? 'worker' : 'workers'}</span>
          <button
            type="button"
            className="entry-modal__stepper-btn"
            onClick={() => setTempWorkers(Math.max(1, tempWorkers - 1))}
            disabled={tempWorkers <= 1}
            aria-label="Decrease personnel"
          >
            <ExpandChevronIcon className="entry-modal__stepper-chevron" />
          </button>
        </div>
        <div className="action-sheet__actions">
          {hasValue && (
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
            >
              Save
            </button>
          </div>
        </div>
      </ActionSheet>
    </>
  );
}

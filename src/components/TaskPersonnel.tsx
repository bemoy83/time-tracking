/**
 * TaskPersonnel component.
 * Displays default crew count summary; opens ActionSheet to edit.
 * Uses ExpandableSection for the outer toggle.
 */

import { useState } from 'react';
import { useTask, updateTaskDefaultWorkers } from '../lib/stores/task-store';
import { ExpandableSection } from './ExpandableSection';
import { ActionSheet } from './ActionSheet';
import { PeopleIcon } from './icons';
import { WorkersStepper } from './WorkersStepper';

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
        sectionSummary={hasValue ? `${currentValue} crew` : undefined}
      >
        <div className="task-personnel__content">
          <span className="task-personnel__section-label section-heading">DEFAULT CREW</span>

          {hasValue ? (
            <div className="task-personnel__summary">
              <span className="task-personnel__value">{currentValue} crew</span>
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
        <WorkersStepper
          value={tempWorkers}
          onChange={setTempWorkers}
          size="large"
        />
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

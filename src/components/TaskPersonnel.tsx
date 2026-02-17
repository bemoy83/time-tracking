/**
 * TaskPersonnel component.
 * Displays and edits the default crew count for a task.
 * Uses ExpandableSection for the outer toggle.
 */

import { useTask, updateTaskDefaultWorkers } from '../lib/stores/task-store';
import { ExpandableSection } from './ExpandableSection';
import { PeopleIcon } from './icons';
import { WorkersStepper } from './WorkersStepper';

interface TaskPersonnelProps {
  taskId: string;
}

export function TaskPersonnel({ taskId }: TaskPersonnelProps) {
  const task = useTask(taskId);

  const hasValue = task?.defaultWorkers != null;
  const currentValue = task?.defaultWorkers ?? 1;

  const handleChange = async (n: number) => {
    await updateTaskDefaultWorkers(taskId, n);
  };

  const handleClear = async () => {
    await updateTaskDefaultWorkers(taskId, null);
  };

  const handleSet = async () => {
    await updateTaskDefaultWorkers(taskId, 1);
  };

  return (
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
            <WorkersStepper
              value={currentValue}
              onChange={handleChange}
              size="large"
            />
            <button
              type="button"
              className="task-personnel__clear-btn btn btn--secondary btn--sm"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="task-personnel__set-btn"
            onClick={handleSet}
          >
            + Set default personnel
          </button>
        )}
      </div>
    </ExpandableSection>
  );
}

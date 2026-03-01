/**
 * TaskProductivity component.
 * Read-only display of target, required, and actual productivity rates.
 * Target   = from template (stored on task)
 * Required = workQuantity / estimated person-hours (calculated)
 * Actual   = workQuantity / actual person-hours (from tracked time)
 */

import { useAttributedPersonHours } from '../lib/hooks/useAttributedPersonHours';
import { useTimerStore } from '../lib/stores/timer-store';
import { useTask, useTaskStore } from '../lib/stores/task-store';
import { useSubtaskTimeRollupMode } from '../lib/stores/subtask-time-rollup-settings';
import { formatProductivity, BUILD_PHASE_LABELS } from '../lib/types';
import { getWorkTypeById } from '../lib/stores/work-type-store';
import { ExpandableSection } from './ExpandableSection';
import { SpeedIcon } from './icons';

interface TaskProductivityProps {
  taskId: string;
  subtaskIds: string[];
  onAttributedRefresh?: (refresh: () => void) => void;
}

export function TaskProductivity({ taskId, subtaskIds, onAttributedRefresh }: TaskProductivityProps) {
  const task = useTask(taskId);
  const { tasks: allTasks } = useTaskStore();
  const { activeTimers } = useTimerStore();
  const subtaskRollupMode = useSubtaskTimeRollupMode();
  const { attributedPersonMs, refresh } = useAttributedPersonHours(
    taskId,
    subtaskIds,
    allTasks,
    activeTimers,
    subtaskRollupMode,
  );

  // Expose refresh to parent for coordination
  if (onAttributedRefresh) {
    onAttributedRefresh(refresh);
  }

  if (!task || task.workQuantity == null || task.workUnit == null) {
    return null;
  }

  const quantity = task.workQuantity;
  const unit = task.workUnit;
  const workers = task.crew ?? 1;
  const workTypeTitle = task.workTypeId ? getWorkTypeById(task.workTypeId)?.title : null;

  // Target rate: from template (stored on task)
  const targetRate = task.targetProductivity;

  // Required rate: quantity / estimated person-hours (calculated)
  const hasEstimate = task.estimatedMinutes != null && task.estimatedMinutes > 0;
  const estimatedPersonHours = hasEstimate
    ? (task.estimatedMinutes! / 60) * workers
    : 0;
  const requiredRate = hasEstimate ? quantity / estimatedPersonHours : null;

  // Actual rate: quantity / attributed person-hours
  const hasTime = attributedPersonMs > 0;
  const actualPersonHours = hasTime ? attributedPersonMs / 3_600_000 : 0;
  const actualRate = hasTime ? quantity / actualPersonHours : null;

  // Nothing to show
  if (targetRate == null && requiredRate == null && actualRate == null) {
    return null;
  }

  const isCompleted = task.status === 'completed';

  // Use target for comparison when available, otherwise fall back to required
  const comparisonRate = targetRate ?? requiredRate;

  // Badge for collapsed state
  const badgeText = actualRate != null
    ? formatProductivity(actualRate, unit)
    : targetRate != null
      ? formatProductivity(targetRate, unit)
      : requiredRate != null
        ? formatProductivity(requiredRate, unit)
        : undefined;

  return (
    <ExpandableSection
      label="PRODUCTIVITY"
      icon={<SpeedIcon className="task-productivity__icon" />}
      defaultOpen={false}
      sectionSummary={badgeText}
    >
      <div className="task-productivity__content">
        {workTypeTitle != null && (
          <div className="task-productivity__row task-productivity__row--meta">
            <span className="task-productivity__label section-heading">WORK TYPE</span>
            <span className="task-productivity__value">
              {workTypeTitle}
              {task.buildPhase != null && ` · ${BUILD_PHASE_LABELS[task.buildPhase]}`}
            </span>
          </div>
        )}

        {targetRate != null && (
          <div className="task-productivity__row">
            <span className="task-productivity__label section-heading">TARGET</span>
            <span className="task-productivity__value">
              {formatProductivity(targetRate, unit)}
            </span>
          </div>
        )}

        {requiredRate != null && (
          <div className="task-productivity__row">
            <span className="task-productivity__label section-heading">REQUIRED</span>
            <span className="task-productivity__value">
              {formatProductivity(requiredRate, unit)}
            </span>
          </div>
        )}

        {actualRate != null && (
          <div className="task-productivity__row">
            <span className="task-productivity__label section-heading">
              {isCompleted ? 'ACHIEVED' : 'SO FAR'}
            </span>
            <span className="task-productivity__value">
              {formatProductivity(actualRate, unit)}
            </span>
          </div>
        )}

        {comparisonRate != null && actualRate != null && (
          <ProductivityComparison required={comparisonRate} actual={actualRate} />
        )}
      </div>
    </ExpandableSection>
  );
}

function ProductivityComparison({ required, actual }: { required: number; actual: number }) {
  const met = actual >= required;
  const pct = Math.round(((actual - required) / required) * 100);

  return (
    <div className={`task-productivity__comparison task-productivity__comparison--${met ? 'met' : 'under'}`}>
      {met
        ? 'Met target'
        : `${Math.abs(pct)}% below target`}
    </div>
  );
}

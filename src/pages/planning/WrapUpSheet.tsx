import { ActionSheet } from '../../components/ActionSheet';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { WORK_UNIT_LABELS } from '../../lib/types';
import { useWrapUpSheetModel } from './hooks/useWrapUpSheetModel';

interface WrapUpSheetProps {
  isOpen: boolean;
  plan: Plan;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onClose: () => void;
  onCompleted: (updatedPlan: Plan) => void;
}

function toRateLabel(rate: number | null, task: Task): string {
  if (rate == null || task.workUnit == null) return 'No measurable productivity yet';
  const unit = WORK_UNIT_LABELS[task.workUnit] ?? task.workUnit;
  return `${rate.toFixed(1)} ${unit}/person-hr`;
}

export function WrapUpSheet({
  isOpen,
  plan,
  tasks,
  timeEntriesByTask,
  onClose,
  onCompleted,
}: WrapUpSheetProps) {
  const model = useWrapUpSheetModel({
    isOpen,
    plan,
    tasks,
    timeEntriesByTask,
    onClose,
    onCompleted,
  });

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title="Wrap Up Review">
      {model.projectTasks.length === 0 ? (
        <p className="wrap-up-sheet__empty">No project tasks found for this plan.</p>
      ) : (
        <div className="wrap-up-sheet">
          {model.groups.map((group) => (
            <section key={group.id} className="wrap-up-sheet__group">
              <h3 className="wrap-up-sheet__group-title">{group.title}</h3>
              <div className="wrap-up-sheet__list">
                {group.tasks.map((task) => {
                  const selected = model.selectedTaskIds.has(task.id);
                  const rate = model.rateByTaskId.get(task.id) ?? null;
                  const isOutlier = model.outlierTaskIds.has(task.id);
                  return (
                    <label key={task.id} className="wrap-up-sheet__row">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => model.toggleSelected(task.id)}
                        disabled={model.isSubmitting}
                      />
                      <span className="wrap-up-sheet__row-content">
                        <span className="wrap-up-sheet__row-title">
                          {task.title}
                          {isOutlier && <span className="wrap-up-sheet__outlier">Outlier</span>}
                        </span>
                        <span className="wrap-up-sheet__row-meta">{toRateLabel(rate, task)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {model.submitError && (
        <p className="wrap-up-sheet__error" role="alert">
          {model.submitError}
        </p>
      )}

      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose} disabled={model.isSubmitting}>
            Cancel
          </button>
          {!model.reviewReady && (
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => model.runWrapUp('save-review-only')}
              disabled={model.isSubmitting}
            >
              Save Review Only
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => model.runWrapUp('archive-and-complete')}
            disabled={model.isSubmitting || model.projectTasks.length === 0}
          >
            Archive and Complete
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}

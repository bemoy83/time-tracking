import { ActionSheet } from '../../components/ActionSheet';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { WORK_UNIT_LABELS } from '../../lib/types';
import { useWrapUpSheetModel } from './hooks/useWrapUpSheetModel';
import { useWrapUpSheetModelV2 } from './hooks/useWrapUpSheetModelV2';
import { getFeatureFlag } from '../../lib/flags/feature-flags';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';

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
  const wrapUpV2Enabled = getFeatureFlag('wrapUpReviewV2');
  const { workTypes } = useWorkTypeStore();

  const model = useWrapUpSheetModel({
    isOpen: isOpen && !wrapUpV2Enabled,
    plan,
    tasks,
    timeEntriesByTask,
    onClose,
    onCompleted,
  });

  const modelV2 = useWrapUpSheetModelV2({
    isOpen: isOpen && wrapUpV2Enabled,
    plan,
    tasks,
    timeEntriesByTask,
    onClose,
    onCompleted,
  });

  if (!wrapUpV2Enabled) {
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

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title="Wrap Up Review v2">
      {modelV2.isLoadingProjection && (
        <p className="wrap-up-sheet__empty">Loading execution return data...</p>
      )}

      {!modelV2.isLoadingProjection && modelV2.projection && (
        <div className="wrap-up-sheet wrap-up-sheet--v2">
          <section className="wrap-up-sheet__meta-block">
            <p className="wrap-up-sheet__row-meta">
              Execution return imported: {modelV2.projection.importedAt ? new Date(modelV2.projection.importedAt).toLocaleString() : 'Not imported'}
            </p>
            <p className="wrap-up-sheet__row-meta">
              Session closed: {modelV2.projection.closedAt ? new Date(modelV2.projection.closedAt).toLocaleString() : 'Unknown'}
            </p>
          </section>

          <section className="wrap-up-sheet__group">
            <h3 className="wrap-up-sheet__group-title">Line Item Review</h3>
            <div className="wrap-up-sheet__list wrap-up-sheet__list--v2">
              {modelV2.projection.lineItems.map((item) => {
                const decision = modelV2.lineItemDecisions.get(item.lineItem.id);
                if (!decision) return null;

                return (
                  <article key={item.lineItem.id} className="wrap-up-sheet__card-v2">
                    <div className="wrap-up-sheet__card-header">
                      <div>
                        <h4 className="wrap-up-sheet__row-title">{item.lineItem.title}</h4>
                        <p className="wrap-up-sheet__row-meta">
                          Status: {decision.executionStatus} · Planned {item.plannedPersonHours.toFixed(1)}h · Actual {item.actualPersonHours.toFixed(1)}h · Variance {item.variancePersonHours.toFixed(1)}h
                        </p>
                        {(item.lineItem.scheduledStart || item.lineItem.scheduledEnd) && (
                          <p className="wrap-up-sheet__row-meta">
                            Scheduled: {item.lineItem.scheduledStart ?? '—'} → {item.lineItem.scheduledEnd ?? item.lineItem.scheduledStart ?? '—'}
                            {item.lineItem.originalScheduledStart || item.lineItem.originalScheduledEnd
                              ? ` (original ${item.lineItem.originalScheduledStart ?? '—'} → ${item.lineItem.originalScheduledEnd ?? item.lineItem.originalScheduledStart ?? '—'})`
                              : ''}
                          </p>
                        )}
                        {item.lineItem.amendmentNote && (
                          <p className="wrap-up-sheet__row-meta">
                            Amendment: {item.lineItem.amendmentNote}
                          </p>
                        )}
                      </div>
                    </div>

                    {(item.executorNote || item.blockReason || item.deferredNote) && (
                      <div className="wrap-up-sheet__executor-notes">
                        {item.executorNote && <p className="wrap-up-sheet__row-meta"><strong>Executor note:</strong> {item.executorNote}</p>}
                        {item.blockReason && (
                          <p className="wrap-up-sheet__row-meta">
                            <strong>Block:</strong> {item.blockReason}{item.blockCategory ? ` (${item.blockCategory})` : ''}
                          </p>
                        )}
                        {item.deferredNote && <p className="wrap-up-sheet__row-meta"><strong>Deferred:</strong> {item.deferredNote}</p>}
                      </div>
                    )}

                    <label className="wrap-up-sheet__decision-row">
                      <input
                        type="checkbox"
                        checked={decision.includeInKpi}
                        onChange={(e) => modelV2.setLineItemIncludeInKpi(item.lineItem.id, e.target.checked)}
                      />
                      <span>Include in KPI</span>
                    </label>

                    {decision.executionStatus === 'blocked' && (
                      <div className="wrap-up-sheet__resolve-block">
                        <span className="wrap-up-sheet__row-meta">Resolve block:</span>
                        <div className="wrap-up-sheet__resolve-block-actions">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => modelV2.setLineItemExecutionStatus(item.lineItem.id, 'completed')}
                          >
                            Mark completed
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => modelV2.setLineItemExecutionStatus(item.lineItem.id, 'deferred')}
                          >
                            Mark deferred
                          </button>
                        </div>
                      </div>
                    )}

                    {decision.executionStatus === 'deferred' && (
                      <label className="wrap-up-sheet__decision-row">
                        <input
                          type="checkbox"
                          checked={decision.deferredDispositionConfirmed}
                          onChange={(e) => modelV2.setDeferredDispositionConfirmed(item.lineItem.id, e.target.checked)}
                        />
                        <span>Confirm "Not Delivered" disposition</span>
                      </label>
                    )}

                    <label className="wrap-up-sheet__review-note">
                      <span className="wrap-up-sheet__row-meta">Planner review note</span>
                      <textarea
                        className="input"
                        rows={2}
                        defaultValue={decision.reviewNote ?? ''}
                        onBlur={(e) => modelV2.setLineItemReviewNote(item.lineItem.id, e.target.value)}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="wrap-up-sheet__group">
            <h3 className="wrap-up-sheet__group-title">Unplanned Work</h3>
            <div className="wrap-up-sheet__list wrap-up-sheet__list--v2">
              {modelV2.projection.unplanned.length === 0 && (
                <p className="wrap-up-sheet__empty">No unplanned tasks found.</p>
              )}
              {modelV2.projection.unplanned.map((item) => {
                const decision = modelV2.unplannedDecisions.get(item.taskId);
                if (!decision) return null;

                return (
                  <article key={item.taskId} className="wrap-up-sheet__card-v2">
                    <h4 className="wrap-up-sheet__row-title">{item.title}</h4>
                    <p className="wrap-up-sheet__row-meta">
                      {item.personHours.toFixed(2)} person-hrs {item.isImportedOnly ? '· Imported-only' : ''}
                    </p>

                    <label className="wrap-up-sheet__decision-row">
                      <input
                        type="checkbox"
                        checked={decision.includeInKpi}
                        onChange={(e) => modelV2.setUnplannedIncludeInKpi(item.taskId, e.target.checked)}
                        disabled={item.isImportedOnly}
                      />
                      <span>Include in KPI</span>
                    </label>

                    <label className="wrap-up-sheet__review-note">
                      <span className="wrap-up-sheet__row-meta">Assign work type</span>
                      <select
                        className="input"
                        value={decision.assignedWorkTypeId ?? ''}
                        onChange={(e) => modelV2.setUnplannedAssignedWorkType(item.taskId, e.target.value || null)}
                        disabled={item.isImportedOnly}
                      >
                        <option value="">Unassigned</option>
                        {workTypes
                          .filter((workType) => workType.readOnly !== true)
                          .map((workType) => (
                            <option key={workType.id} value={workType.id}>
                              {workType.title} · {WORK_UNIT_LABELS[workType.workUnit]} · {workType.buildPhase}
                            </option>
                          ))}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <div
        className={`action-sheet__actions${modelV2.validationErrors.length > 0 ? ' action-sheet__actions--stacked' : ''}`}
      >
        {modelV2.validationErrors.length > 0 && (
          <div className="wrap-up-sheet__validation-block" role="alert">
            <p className="wrap-up-sheet__validation-title">Complete wrap-up requires:</p>
            <ul className="wrap-up-sheet__validation-list">
              {modelV2.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {modelV2.submitError && (
          <p className="wrap-up-sheet__error wrap-up-sheet__error--block" role="alert">
            {modelV2.submitError}
          </p>
        )}
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose} disabled={modelV2.isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            onClick={() => {
              void modelV2.runWrapUp('save-review-only');
            }}
            disabled={modelV2.isSubmitting || !modelV2.canSubmit}
          >
            Save Review Only
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => {
              void modelV2.runWrapUp('archive-and-complete');
            }}
            disabled={modelV2.isSubmitting || !modelV2.canSubmit || modelV2.isLoadingProjection}
            title={
              !modelV2.canSubmit && modelV2.validationErrors.length > 0
                ? modelV2.validationErrors.join('. ')
                : undefined
            }
            aria-describedby={
              !modelV2.canSubmit && modelV2.validationErrors.length > 0
                ? 'wrapup-validation-errors'
                : undefined
            }
          >
            Complete Wrap-up
          </button>
        </div>
      </div>
      {modelV2.validationErrors.length > 0 && (
        <div id="wrapup-validation-errors" className="sr-only" aria-live="polite">
          {modelV2.validationErrors.join('. ')}
        </div>
      )}
    </ActionSheet>
  );
}

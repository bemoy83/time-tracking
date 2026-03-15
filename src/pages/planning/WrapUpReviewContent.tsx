import type { RefObject } from 'react';
import { LoadingBlock } from '../../components/LoadingBlock';
import { getPhaseFields, isPhaseActive } from '../../lib/planning/plan-model';
import type { WorkType } from '../../lib/types';
import { BUILD_PHASE_LABELS, BUILD_PHASES, WORK_UNIT_LABELS } from '../../lib/types';
import type { UseWrapUpSheetModelV2Result } from './hooks/useWrapUpSheetModelV2';

interface WrapUpReviewContentProps {
  model: UseWrapUpSheetModelV2Result;
  workTypes: WorkType[];
  onClose: () => void;
  validationBlockRef: RefObject<HTMLDivElement | null>;
  layout: 'sheet' | 'pane';
}

function getCardGridClassName(layout: WrapUpReviewContentProps['layout']): string {
  return layout === 'sheet'
    ? 'wrap-up-sheet__list wrap-up-sheet__list--v2'
    : 'wrap-up-review-pane__card-grid';
}

export function WrapUpReviewContent({
  model,
  workTypes,
  onClose,
  validationBlockRef,
  layout,
}: WrapUpReviewContentProps) {
  const content = (
    <>
      {model.isLoadingProjection && (
        <LoadingBlock message="Loading execution return data…" />
      )}

      {!model.isLoadingProjection && model.projectionLoadError && (
        <p className="wrap-up-sheet__error wrap-up-sheet__error--block" role="alert">
          {model.projectionLoadError}. Try closing and reopening the wrap-up review.
        </p>
      )}

      {!model.isLoadingProjection && !model.projection && !model.projectionLoadError && (
        <p className="wrap-up-sheet__empty">No execution data available for this plan.</p>
      )}

      {!model.isLoadingProjection && model.projection && (
        <div className={layout === 'sheet' ? 'wrap-up-sheet wrap-up-sheet--v2' : undefined}>
          <section className="wrap-up-sheet__meta-block">
            <p className="wrap-up-sheet__row-meta">
              Execution return imported: {model.projection.importedAt ? new Date(model.projection.importedAt).toLocaleString() : 'Not imported'}
            </p>
            <p className="wrap-up-sheet__row-meta">
              Session closed: {model.projection.closedAt ? new Date(model.projection.closedAt).toLocaleString() : 'Unknown'}
            </p>
          </section>

          <section className="wrap-up-sheet__group">
            <h3 className="wrap-up-sheet__group-title">Line Item Review</h3>
            <div className={getCardGridClassName(layout)}>
              {model.projection.lineItems.map((item) => {
                const decision = model.lineItemDecisions.get(item.lineItem.id);
                if (!decision) return null;

                const hasError = model.lineItemIdsWithErrors.has(item.lineItem.id);
                const activePhases = BUILD_PHASES.filter((phase) => isPhaseActive(item.lineItem, phase));
                const phaseLabels = activePhases.map((phase) => BUILD_PHASE_LABELS[phase]).join(', ');

                return (
                  <article key={item.lineItem.id} className={`wrap-up-sheet__card-v2${hasError ? ' wrap-up-sheet__card-v2--error' : ''}`}>
                    <div className="wrap-up-sheet__card-header">
                      <div>
                        <h4 className="wrap-up-sheet__row-title">{item.lineItem.title}</h4>
                        <p className="wrap-up-sheet__row-meta">
                          Work type: {item.lineItem.workTypeTitle} · {WORK_UNIT_LABELS[item.lineItem.workUnit] ?? item.lineItem.workUnit} · {phaseLabels}
                        </p>
                        <p className="wrap-up-sheet__row-meta">
                          Status: {decision.executionStatus} · Planned {item.plannedPersonHours.toFixed(1)}h · Actual {item.actualPersonHours.toFixed(1)}h · Variance {item.variancePersonHours.toFixed(1)}h
                        </p>
                        {activePhases.map((phase) => {
                          const pf = getPhaseFields(item.lineItem, phase);
                          if (!pf.scheduledStart && !pf.scheduledEnd) return null;
                          return (
                            <p key={phase} className="wrap-up-sheet__row-meta">
                              {BUILD_PHASE_LABELS[phase]} scheduled: {pf.scheduledStart ?? '-'} to {pf.scheduledEnd ?? pf.scheduledStart ?? '-'}
                              {pf.originalScheduledStart || pf.originalScheduledEnd
                                ? ` (original ${pf.originalScheduledStart ?? '-'} to ${pf.originalScheduledEnd ?? pf.originalScheduledStart ?? '-'})`
                                : ''}
                            </p>
                          );
                        })}
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
                        onChange={(e) => model.setLineItemIncludeInKpi(item.lineItem.id, e.target.checked)}
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
                            onClick={() => model.setLineItemExecutionStatus(item.lineItem.id, 'completed')}
                          >
                            Mark completed
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => model.setLineItemExecutionStatus(item.lineItem.id, 'deferred')}
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
                          onChange={(e) => model.setDeferredDispositionConfirmed(item.lineItem.id, e.target.checked)}
                        />
                        <span>Confirm "Not Delivered" disposition</span>
                        {hasError && !decision.deferredDispositionConfirmed && (
                          <span className="wrap-up-sheet__card-hint" role="status">Required to complete</span>
                        )}
                      </label>
                    )}

                    <label className="wrap-up-sheet__review-note">
                      <span className="wrap-up-sheet__row-meta">Planner review note</span>
                      <textarea
                        className="input"
                        rows={2}
                        defaultValue={decision.reviewNote ?? ''}
                        onBlur={(e) => model.setLineItemReviewNote(item.lineItem.id, e.target.value)}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="wrap-up-sheet__group">
            <h3 className="wrap-up-sheet__group-title">Unplanned Work</h3>
            <p className="wrap-up-sheet__row-meta wrap-up-sheet__unplanned-note">
              Unplanned tasks are not archived during wrap-up. KPI and work type settings are still applied.
            </p>
            <div className={getCardGridClassName(layout)}>
              {model.projection.unplanned.length === 0 && (
                <p className="wrap-up-sheet__empty">No unplanned tasks found.</p>
              )}
              {model.projection.unplanned.map((item) => {
                const decision = model.unplannedDecisions.get(item.taskId);
                if (!decision) return null;
                const hasUnplannedError = model.unplannedTaskIdsWithErrors.has(item.taskId);

                return (
                  <article key={item.taskId} className={`wrap-up-sheet__card-v2${hasUnplannedError ? ' wrap-up-sheet__card-v2--error' : ''}`}>
                    <h4 className="wrap-up-sheet__row-title">{item.title}</h4>
                    <p className="wrap-up-sheet__row-meta">
                      {item.personHours.toFixed(2)} person-hrs {item.isImportedOnly ? '· Imported-only' : ''}
                    </p>

                    <label className="wrap-up-sheet__decision-row">
                      <input
                        type="checkbox"
                        checked={decision.includeInKpi}
                        onChange={(e) => model.setUnplannedIncludeInKpi(item.taskId, e.target.checked)}
                        disabled={item.isImportedOnly && !decision.includeInKpi}
                      />
                      <span>Include in KPI</span>
                      {hasUnplannedError && item.isImportedOnly && decision.includeInKpi && (
                        <span className="wrap-up-sheet__card-hint" role="status">Imported-only cannot be in KPI</span>
                      )}
                    </label>

                    <label className="wrap-up-sheet__review-note">
                      <span className="wrap-up-sheet__row-meta">Assign work type</span>
                      <select
                        className="input"
                        value={decision.assignedWorkTypeId ?? ''}
                        onChange={(e) => model.setUnplannedAssignedWorkType(item.taskId, e.target.value || null)}
                        disabled={item.isImportedOnly}
                      >
                        <option value="">Unassigned</option>
                        {workTypes
                          .filter((workType) => workType.readOnly !== true)
                          .map((workType) => (
                            <option key={workType.id} value={workType.id}>
                              {workType.title} · {WORK_UNIT_LABELS[workType.workUnit]}
                            </option>
                          ))}
                      </select>
                      {hasUnplannedError && decision.includeInKpi && (decision.assignedWorkTypeId == null || item.isImportedOnly) && (
                        <span className="wrap-up-sheet__card-hint" role="status">
                          {item.isImportedOnly ? 'Uncheck "Include in KPI" or assign work type' : 'Required when including in KPI'}
                        </span>
                      )}
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );

  const actions = (
    <>
      {model.validationErrors.length > 0 && (
        <div ref={validationBlockRef as unknown as RefObject<HTMLDivElement>} className="wrap-up-sheet__validation-block" role="alert">
          <p className="wrap-up-sheet__validation-title">Complete wrap-up requires:</p>
          <ul className="wrap-up-sheet__validation-list">
            {model.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {model.submitError && (
        <p className="wrap-up-sheet__error wrap-up-sheet__error--block" role="alert">
          {model.submitError}
        </p>
      )}
      <div className={layout === 'sheet' ? 'action-sheet__actions-right' : 'wrap-up-review-pane__footer-actions'}>
        <button type="button" className="btn btn--secondary btn--lg" onClick={onClose} disabled={model.isSubmitting}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--lg"
          onClick={() => {
            if (!model.canSubmit) {
              validationBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              return;
            }
            void model.runWrapUp('save-review-only');
          }}
          disabled={model.isSubmitting}
        >
          Save Review Only
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => {
            if (!model.canSubmit) {
              validationBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              return;
            }
            void model.runWrapUp('archive-and-complete');
          }}
          disabled={model.isSubmitting || model.isLoadingProjection || !model.projection}
          title={
            !model.projection
              ? 'Execution data must load first'
              : !model.canSubmit && model.validationErrors.length > 0
                ? model.validationErrors.join('. ')
                : undefined
          }
          aria-describedby={
            !model.canSubmit && model.validationErrors.length > 0
              ? 'wrapup-validation-errors'
              : undefined
          }
        >
          Complete Wrap-up
        </button>
      </div>
      {model.validationErrors.length > 0 && (
        <div id="wrapup-validation-errors" className="sr-only" aria-live="polite">
          {model.validationErrors.join('. ')}
        </div>
      )}
    </>
  );

  if (layout === 'pane') {
    return (
      <>
        <div className="wrap-up-review-pane__body">
          {content}
        </div>
        <footer className="wrap-up-review-pane__footer">
          {actions}
        </footer>
      </>
    );
  }

  return (
    <>
      {content}
      <div className={`action-sheet__actions wrap-up-sheet__actions-bar${model.validationErrors.length > 0 ? ' action-sheet__actions--stacked' : ''}`}>
        {actions}
      </div>
    </>
  );
}

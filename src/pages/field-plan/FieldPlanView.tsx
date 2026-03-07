import { useRef } from 'react';
import { BreadcrumbNav } from '../../components/BreadcrumbNav';
import { Fab } from '../../components/Fab';
import { ImportIcon, TaskListIcon } from '../../components/icons';
import { FieldPlanActionSheet } from './components/FieldPlanActionSheet';
import { FieldPlanPlanDetail } from './components/FieldPlanPlanDetail';
import { FieldPlanPlanSelector } from './components/FieldPlanPlanSelector';
import { useFieldPlanModel } from './useFieldPlanModel';

interface FieldPlanViewProps {
  onBack?: () => void;
}

export function FieldPlanView({ onBack }: FieldPlanViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const model = useFieldPlanModel();

  const breadcrumbSegments = model.selectedPlan
    ? [{ label: 'Field Plan' }, { label: model.selectedPlan.title }]
    : [{ label: 'Field Plan' }];

  return (
    <div className="field-plan-view">
      <div className="field-plan-view__title-section">
        {onBack ? (
          <BreadcrumbNav onBack={onBack} segments={breadcrumbSegments} />
        ) : (
          <h1 className="field-plan-view__title">Field Plan</h1>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={model.handleFileChange}
      />

      <div className="field-plan-view__content">
        {model.preview && (
          <section className="field-plan-import-card">
            <p className="field-plan-import-card__title">
              <strong>{model.preview.title}</strong> · {model.preview.lineItemCount} items · {model.preview.workTypeCount} work types
            </p>
            <p className="field-plan-import-card__meta">
              Last modified {new Date(model.preview.lastModifiedAt).toLocaleString()}
            </p>
            {model.preview.conflict === 'planner-plan' && (
              <p className="field-plan-import-card__meta">Conflict: planner-owned plan exists on this device.</p>
            )}
            {model.preview.conflict === 'replace-or-skip' && (
              <p className="field-plan-import-card__meta">Conflict: existing received plan found. Replace or skip.</p>
            )}
            {model.preview.conflict === 'merge' && (
              <p className="field-plan-import-card__meta">Existing execution state found. Import will merge.</p>
            )}
            {model.preview.lineItemDiffSummary && (
              <div className="field-plan-import-card__diff-summary">
                <span className="field-plan-import-card__diff-label">Line item changes:</span>
                {model.preview.lineItemDiffSummary.new > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--new">
                    {model.preview.lineItemDiffSummary.new} new
                  </span>
                )}
                {model.preview.lineItemDiffSummary.updated > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--updated">
                    {model.preview.lineItemDiffSummary.updated} updated
                  </span>
                )}
                {model.preview.lineItemDiffSummary.unchanged > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--unchanged">
                    {model.preview.lineItemDiffSummary.unchanged} unchanged
                  </span>
                )}
                {model.preview.lineItemDiffSummary.removed > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--removed">
                    {model.preview.lineItemDiffSummary.removed} removed
                  </span>
                )}
              </div>
            )}
            <div className="field-plan-import-card__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={model.isApplyingImport || model.preview.conflict === 'planner-plan'}
                onClick={() => { void model.handleApplyImport('replace'); }}
              >
                {model.preview.conflict === 'merge' ? 'Merge Import' : 'Apply Import'}
              </button>
              {model.preview.conflict === 'replace-or-skip' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={model.isApplyingImport}
                  onClick={() => { void model.handleApplyImport('skip'); }}
                >
                  Skip
                </button>
              )}
            </div>
          </section>
        )}

        {model.message && <p className="field-plan-view__message">{model.message}</p>}

        {model.plans.length === 0 ? (
          <div className="empty-state">
            <TaskListIcon className="empty-state__icon" />
            <p className="empty-state__heading">No received plans</p>
            <p className="empty-state__text">Import a plan package to get started.</p>
          </div>
        ) : (
          <>
            <FieldPlanPlanSelector
              receivedPlans={model.receivedPlans}
              closedPlans={model.closedPlans}
              selectedPlanId={model.selectedPlanId}
              showPastEvents={model.showPastEvents}
              onTogglePastEvents={model.togglePastEvents}
              onSelectPlan={model.setSelectedPlanId}
            />

            {model.selectedPlan && (
              <FieldPlanPlanDetail
                selectedPlan={model.selectedPlan}
                projectColor={model.projectColor}
                progressPercent={model.progressPercent}
                lineItemStatusSummary={model.lineItemStatusSummary}
                lineItems={model.lineItems}
                deadlineSummary={model.deadlineSummary}
                statusGroups={model.statusGroups}
                completedExpanded={model.completedExpanded}
                deferredExpanded={model.deferredExpanded}
                canExecute={model.canExecute}
                personHours={model.selectedPlanPersonHours}
                unplannedTasks={model.unplannedTasks}
                onToggleCompletedExpanded={model.toggleCompletedExpanded}
                onToggleDeferredExpanded={model.toggleDeferredExpanded}
                onReleaseToToday={model.handleReleaseToToday}
                onOpenActions={model.openActions}
                onExportExecutionReturn={() => { void model.handleExportExecutionReturn(); }}
              />
            )}
          </>
        )}
      </div>

      <Fab
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import plan"
      >
        <ImportIcon className="fab__icon" />
      </Fab>

      <FieldPlanActionSheet
        formMode={model.formMode}
        onClose={model.closeForm}
        onSetFormMode={model.setFormMode}
        onReleaseToToday={model.handleReleaseToToday}
        onBlockSubmit={model.handleBlockSubmit}
        onDeferSubmit={model.handleDeferSubmit}
        onNoteSubmit={model.handleNoteSubmit}
        onClearBlock={model.handleClearBlock}
        onReactivateDeferred={model.handleReactivateDeferred}
      />
    </div>
  );
}

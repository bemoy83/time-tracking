import { CountBadge } from '../../../components/CountBadge';
import { BUILD_PHASE_LABELS } from '../../../lib/types';
import { STATUS_PRIORITY, type FieldPlanLineItemSummary } from '../field-plan-model';
import { FieldPlanLineItemRow } from './FieldPlanLineItemRow';
import { FieldPlanReleaseBatchButton } from './FieldPlanReleaseBatchButton';

interface FieldPlanPhaseViewProps {
  allLineItems: FieldPlanLineItemSummary[];
  onReleaseEligibleBatch: (items: FieldPlanLineItemSummary[]) => void;
  onReleaseToToday: (lineItem: FieldPlanLineItemSummary) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
}

export function FieldPlanPhaseView({
  allLineItems,
  onReleaseEligibleBatch,
  onReleaseToToday,
  onOpenActions,
}: FieldPlanPhaseViewProps) {
  const assemblyItems = allLineItems
    .filter((li) => li.phase === 'assembly')
    .sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return a.planTitle.localeCompare(b.planTitle) || a.item.title.localeCompare(b.item.title);
    });

  const dismantleItems = allLineItems
    .filter((li) => li.phase === 'dismantle')
    .sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return a.planTitle.localeCompare(b.planTitle) || a.item.title.localeCompare(b.item.title);
    });

  if (assemblyItems.length === 0 && dismantleItems.length === 0) {
    return (
      <p className="field-plan-view__message">No active line items across received plans.</p>
    );
  }

  return (
    <div className="field-plan__phase-view">
      {assemblyItems.length > 0 && (
        <section className="field-plan__phase-section">
          <div className="field-plan__phase-section-header">
            <h2 className="field-plan__phase-section-title">
              <span className="field-plan-row__phase-badge field-plan-row__phase-badge--assembly">
                {BUILD_PHASE_LABELS['assembly']}
              </span>
              <CountBadge count={assemblyItems.length} variant="muted" />
            </h2>
            <FieldPlanReleaseBatchButton
              lineItems={assemblyItems}
              scopeLabel={BUILD_PHASE_LABELS['assembly']}
              onReleaseBatch={onReleaseEligibleBatch}
            />
          </div>
          <div className="field-plan__task-list">
            {assemblyItems.map((li) => (
              <FieldPlanLineItemRow
                key={`${li.planId}:${li.item.id}:${li.phase}`}
                lineItem={li}
                canExecute={li.planCanExecute}
                showPlanLabel
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {dismantleItems.length > 0 && (
        <section className="field-plan__phase-section">
          <div className="field-plan__phase-section-header">
            <h2 className="field-plan__phase-section-title">
              <span className="field-plan-row__phase-badge field-plan-row__phase-badge--dismantle">
                {BUILD_PHASE_LABELS['dismantle']}
              </span>
              <CountBadge count={dismantleItems.length} variant="muted" />
            </h2>
            <FieldPlanReleaseBatchButton
              lineItems={dismantleItems}
              scopeLabel={BUILD_PHASE_LABELS['dismantle']}
              onReleaseBatch={onReleaseEligibleBatch}
            />
          </div>
          <div className="field-plan__task-list">
            {dismantleItems.map((li) => (
              <FieldPlanLineItemRow
                key={`${li.planId}:${li.item.id}:${li.phase}`}
                lineItem={li}
                canExecute={li.planCanExecute}
                showPlanLabel
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

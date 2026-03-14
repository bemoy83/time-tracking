import { CountBadge } from '../../../components/CountBadge';
import { BUILD_PHASE_LABELS } from '../../../lib/types';
import { STATUS_PRIORITY, type FieldPlanLineItemSummary } from '../field-plan-model';
import { FieldPlanLineItemRow } from './FieldPlanLineItemRow';

interface FieldPlanPhaseViewProps {
  allLineItems: FieldPlanLineItemSummary[];
  onReleaseToToday: (lineItem: FieldPlanLineItemSummary) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
}

export function FieldPlanPhaseView({
  allLineItems,
  onReleaseToToday,
  onOpenActions,
}: FieldPlanPhaseViewProps) {
  const buildUpItems = allLineItems
    .filter((li) => li.phase === 'build-up')
    .sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return a.planTitle.localeCompare(b.planTitle) || a.item.title.localeCompare(b.item.title);
    });

  const tearDownItems = allLineItems
    .filter((li) => li.phase === 'tear-down')
    .sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return a.planTitle.localeCompare(b.planTitle) || a.item.title.localeCompare(b.item.title);
    });

  if (buildUpItems.length === 0 && tearDownItems.length === 0) {
    return (
      <p className="field-plan-view__message">No active line items across received plans.</p>
    );
  }

  return (
    <div className="field-plan__phase-view">
      {buildUpItems.length > 0 && (
        <section className="field-plan__phase-section">
          <h2 className="field-plan__phase-section-title">
            <span className="field-plan-row__phase-badge field-plan-row__phase-badge--build-up">
              {BUILD_PHASE_LABELS['build-up']}
            </span>
            <CountBadge count={buildUpItems.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list">
            {buildUpItems.map((li) => (
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

      {tearDownItems.length > 0 && (
        <section className="field-plan__phase-section">
          <h2 className="field-plan__phase-section-title">
            <span className="field-plan-row__phase-badge field-plan-row__phase-badge--tear-down">
              {BUILD_PHASE_LABELS['tear-down']}
            </span>
            <CountBadge count={tearDownItems.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list">
            {tearDownItems.map((li) => (
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

import { CountBadge } from '../../../components/CountBadge';
import {
  CheckIcon,
  ClockIcon,
  ExpandChevronIcon,
  PlayIcon,
  TaskListIcon,
  WarningIcon,
} from '../../../components/icons';
import type { Plan, PlanLineItem } from '../../../lib/planning/plan-model';
import type { Task } from '../../../lib/types';
import type { FieldPlanLineItemSummary } from '../field-plan-model';
import type { FieldPlanStatusGroups } from '../field-plan-overlay-types';
import { FieldPlanLineItemRow } from './FieldPlanLineItemRow';

interface LineItemStatusSummary {
  completed: number;
}

interface DeadlineSummary {
  overdue: number;
  atRisk: number;
}

interface FieldPlanPlanDetailProps {
  selectedPlan: Plan;
  progressPercent: number;
  lineItemStatusSummary: LineItemStatusSummary;
  lineItems: FieldPlanLineItemSummary[];
  deadlineSummary: DeadlineSummary;
  statusGroups: FieldPlanStatusGroups;
  completedExpanded: boolean;
  deferredExpanded: boolean;
  canExecute: boolean;
  personHours: string;
  unplannedTasks: Task[];
  onToggleCompletedExpanded: () => void;
  onToggleDeferredExpanded: () => void;
  onReleaseToToday: (lineItem: PlanLineItem) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
  onExportExecutionReturn: () => void;
}

export function FieldPlanPlanDetail({
  selectedPlan,
  progressPercent,
  lineItemStatusSummary,
  lineItems,
  deadlineSummary,
  statusGroups,
  completedExpanded,
  deferredExpanded,
  canExecute,
  personHours,
  unplannedTasks,
  onToggleCompletedExpanded,
  onToggleDeferredExpanded,
  onReleaseToToday,
  onOpenActions,
  onExportExecutionReturn,
}: FieldPlanPlanDetailProps) {
  return (
    <>
      <section className="field-plan__header-card">
        <h3 className="field-plan__plan-title">{selectedPlan.title}</h3>
        <div className="field-plan__progress">
          <div className="field-plan__progress-track" aria-hidden="true">
            <div
              className="field-plan__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="field-plan__progress-label">
            {lineItemStatusSummary.completed}/{lineItems.length} completed
          </span>
        </div>
        <div className="field-plan__summary-row">
          <span className="field-plan__summary-stat">
            <ClockIcon className="field-plan__summary-icon" />
            {personHours}
          </span>
          {deadlineSummary.overdue > 0 && (
            <span className="field-plan__summary-stat field-plan__summary-stat--risk">
              {deadlineSummary.overdue} overdue
            </span>
          )}
          {deadlineSummary.atRisk > 0 && (
            <span className="field-plan__summary-stat field-plan__summary-stat--warning">
              {deadlineSummary.atRisk} at risk
            </span>
          )}
        </div>
      </section>

      {statusGroups.inProgress.length > 0 && (
        <section className="field-plan__section">
          <h2 className="field-plan__section-title section-heading">
            <PlayIcon className="field-plan__icon" />
            In Progress
            <CountBadge count={statusGroups.inProgress.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list field-plan__task-list--active">
            {statusGroups.inProgress.map((li) => (
              <FieldPlanLineItemRow
                key={li.item.id}
                lineItem={li}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {statusGroups.blocked.length > 0 && (
        <section className="field-plan__section">
          <h2 className="field-plan__section-title section-heading section-heading--blocked">
            <WarningIcon className="field-plan__icon" />
            Blocked
            <CountBadge count={statusGroups.blocked.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list field-plan__task-list--blocked">
            {statusGroups.blocked.map((li) => (
              <FieldPlanLineItemRow
                key={li.item.id}
                lineItem={li}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {statusGroups.pending.length > 0 && (
        <section className="field-plan__section">
          <h2 className="field-plan__section-title section-heading">
            <TaskListIcon className="field-plan__icon" />
            Pending
            <CountBadge count={statusGroups.pending.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list">
            {statusGroups.pending.map((li) => (
              <FieldPlanLineItemRow
                key={li.item.id}
                lineItem={li}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {statusGroups.completed.length > 0 && (
        <section className="field-plan__section field-plan__section--completed">
          <button
            type="button"
            className="field-plan__collapsible-toggle"
            onClick={onToggleCompletedExpanded}
            aria-expanded={completedExpanded}
          >
            <CheckIcon className="field-plan__toggle-icon field-plan__toggle-icon--ready" />
            <span>Completed</span>
            <CountBadge count={statusGroups.completed.length} variant="muted" />
            <ExpandChevronIcon
              className={`field-plan__toggle-chevron${completedExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
            />
          </button>
          {completedExpanded && (
            <div className="field-plan__task-list field-plan__task-list--completed">
              {statusGroups.completed.map((li) => (
                <FieldPlanLineItemRow
                  key={li.item.id}
                  lineItem={li}
                  canExecute={canExecute}
                  onRelease={onReleaseToToday}
                  onOpenActions={onOpenActions}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {statusGroups.deferred.length > 0 && (
        <section className="field-plan__section field-plan__section--deferred">
          <button
            type="button"
            className="field-plan__collapsible-toggle"
            onClick={onToggleDeferredExpanded}
            aria-expanded={deferredExpanded}
          >
            <span>Deferred</span>
            <CountBadge count={statusGroups.deferred.length} variant="muted" />
            <ExpandChevronIcon
              className={`field-plan__toggle-chevron${deferredExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
            />
          </button>
          {deferredExpanded && (
            <div className="field-plan__task-list field-plan__task-list--deferred">
              {statusGroups.deferred.map((li) => (
                <FieldPlanLineItemRow
                  key={li.item.id}
                  lineItem={li}
                  canExecute={canExecute}
                  onRelease={onReleaseToToday}
                  onOpenActions={onOpenActions}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {unplannedTasks.length > 0 && (
        <details className="field-plan__unplanned">
          <summary>Unplanned tasks ({unplannedTasks.length})</summary>
          <ul className="field-plan__unplanned-list">
            {unplannedTasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        className="btn btn--primary btn--full"
        onClick={onExportExecutionReturn}
      >
        Export Execution Return
      </button>
    </>
  );
}

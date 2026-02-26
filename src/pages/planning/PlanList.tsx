import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import { isPlanReviewReady } from '../../lib/planning/plan-lifecycle';
import { ChevronRightIcon, TrashIcon } from '../../components/icons';
import { Fab } from '../../components/Fab';
import { StatusBadge } from '../../components/StatusBadge';

interface PlanListProps {
  plans: Plan[];
  tasks: Task[];
  onSelect: (plan: Plan) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  onOpenInsights: () => void;
}

export function PlanList({
  plans,
  tasks,
  onSelect,
  onCreate,
  onDelete,
  onOpenWrapUp,
  onOpenInsights,
}: PlanListProps) {
  return (
    <div className="planning-view">
      <header className="planning-view__header">
        <h1 className="planning-view__title">Plans</h1>
        <button type="button" className="btn btn--secondary" onClick={onOpenInsights}>
          Insights
        </button>
      </header>

      <Fab onClick={onCreate} aria-label="New plan" />

      {plans.length === 0 ? (
        <p className="planning-view__empty">No plans yet. Create one to get started.</p>
      ) : (
        <ul className="planning-view__list">
          {plans.map((plan) => {
            const reviewReady = isPlanReviewReady(plan, tasks);
            const badgeVariant = plan.reviewedAt != null ? 'reviewed' : reviewReady ? 'review-ready' : plan.status;
            return (
              <li key={plan.id} className="planning-view__item">
                <button className="planning-view__item-btn" onClick={() => onSelect(plan)}>
                  <span className="planning-view__item-content">
                    <span className="planning-view__item-title">{plan.title}</span>
                    <span className="planning-view__item-meta">
                      {plan.lineItems.length} {plan.lineItems.length === 1 ? 'package' : 'packages'}
                    </span>
                  </span>
                  <StatusBadge variant={badgeVariant} />
                  <ChevronRightIcon className="planning-view__item-chevron" />
                </button>
                {reviewReady && (
                  <button
                    className="planning-view__item-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWrapUp(plan);
                    }}
                    aria-label={`Wrap up ${plan.title}`}
                  >
                    Wrap Up
                  </button>
                )}
                <button
                  className="planning-view__item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(plan.id);
                  }}
                  aria-label={`Delete ${plan.title}`}
                >
                  <TrashIcon className="planning-view__item-delete-icon" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

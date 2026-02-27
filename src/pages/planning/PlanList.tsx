import { useMemo } from 'react';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import {
  isPlanReviewReady,
  isPlanArchived,
  sortPlansForSidebar,
} from '../../lib/planning/plan-lifecycle';
import { ChevronRightIcon, TrashIcon, PlusIcon, SparklesIcon } from '../../components/icons';
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
  /** Currently selected plan ID — used for workspace highlight. */
  selectedPlanId?: string | null;
  /** When true, renders compact sidebar variant without FAB. */
  sidebarMode?: boolean;
}

export function PlanList({
  plans,
  tasks,
  onSelect,
  onCreate,
  onDelete,
  onOpenWrapUp,
  onOpenInsights,
  selectedPlanId,
  sidebarMode = false,
}: PlanListProps) {
  const { activePlans, archivedPlans } = useMemo(() => {
    const active: Plan[] = [];
    const archived: Plan[] = [];
    for (const plan of plans) {
      if (plan.status === 'received' || plan.status === 'session-closed') continue;
      if (isPlanArchived(plan)) {
        archived.push(plan);
      } else {
        active.push(plan);
      }
    }
    return {
      activePlans: sortPlansForSidebar(active, tasks),
      archivedPlans: archived.sort((a, b) =>
        (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''),
      ),
    };
  }, [plans, tasks]);

  if (sidebarMode) {
    return (
      <div className="planning-view planning-view--sidebar">
        {/* Persistent create + insights actions */}
        <div className="planning-sidebar__actions">
          <button
            type="button"
            className="planning-sidebar__create-btn"
            onClick={onCreate}
            aria-label="New plan"
          >
            <PlusIcon className="planning-sidebar__action-icon" />
            <span>New Plan</span>
          </button>
          <button
            type="button"
            className="planning-sidebar__insights-btn"
            onClick={onOpenInsights}
            aria-label="Insights"
          >
            <SparklesIcon className="planning-sidebar__action-icon" />
            <span>Insights</span>
          </button>
        </div>

        {/* Active zone */}
        {activePlans.length > 0 && (
          <SidebarZone label="Active">
            <PlanItems
              plans={activePlans}
              tasks={tasks}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpenWrapUp={onOpenWrapUp}
              compact
            />
          </SidebarZone>
        )}

        {/* Archive zone */}
        {archivedPlans.length > 0 && (
          <SidebarZone label="Archive">
            <PlanItems
              plans={archivedPlans}
              tasks={tasks}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpenWrapUp={onOpenWrapUp}
              compact
            />
          </SidebarZone>
        )}

        {plans.length === 0 && (
          <p className="planning-view__empty">No plans yet.</p>
        )}
      </div>
    );
  }

  // --- Full-page list (mobile stack) ---
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
        <>
          {activePlans.length > 0 && (
            <ul className="planning-view__list">
              {activePlans.map((plan) => (
                <PlanListItem
                  key={plan.id}
                  plan={plan}
                  tasks={tasks}
                  selectedPlanId={selectedPlanId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onOpenWrapUp={onOpenWrapUp}
                />
              ))}
            </ul>
          )}
          {archivedPlans.length > 0 && (
            <>
              <h2 className="planning-view__zone-heading">Archive</h2>
              <ul className="planning-view__list planning-view__list--archive">
                {archivedPlans.map((plan) => (
                  <PlanListItem
                    key={plan.id}
                    plan={plan}
                    tasks={tasks}
                    selectedPlanId={selectedPlanId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onOpenWrapUp={onOpenWrapUp}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

// --- Shared plan item rendering ---

interface PlanItemsProps {
  plans: Plan[];
  tasks: Task[];
  selectedPlanId?: string | null;
  onSelect: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  compact?: boolean;
}

function PlanItems({
  plans,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  compact,
}: PlanItemsProps) {
  return (
    <ul className={`planning-view__list${compact ? ' planning-view__list--compact' : ''}`}>
      {plans.map((plan) => (
        <PlanListItem
          key={plan.id}
          plan={plan}
          tasks={tasks}
          selectedPlanId={selectedPlanId}
          onSelect={onSelect}
          onDelete={onDelete}
          onOpenWrapUp={onOpenWrapUp}
          compact={compact}
        />
      ))}
    </ul>
  );
}

interface PlanListItemProps {
  plan: Plan;
  tasks: Task[];
  selectedPlanId?: string | null;
  onSelect: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  compact?: boolean;
}

function PlanListItem({
  plan,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  compact,
}: PlanListItemProps) {
  const reviewReady = isPlanReviewReady(plan, tasks);
  const badgeVariant = plan.reviewedAt != null
    ? 'reviewed'
    : reviewReady
      ? 'review-ready'
      : plan.status;

  return (
    <li className={`planning-view__item${selectedPlanId === plan.id ? ' planning-view__item--selected' : ''}`}>
      <button className="planning-view__item-btn" onClick={() => onSelect(plan)}>
        <span className="planning-view__item-content">
          <span className="planning-view__item-title">{plan.title}</span>
          {!compact && (
            <span className="planning-view__item-meta">
              {plan.lineItems.length} {plan.lineItems.length === 1 ? 'package' : 'packages'}
            </span>
          )}
        </span>
        <StatusBadge variant={badgeVariant} />
        {!compact && <ChevronRightIcon className="planning-view__item-chevron" />}
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
}

// --- Sidebar zone heading ---

function SidebarZone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="planning-sidebar__zone">
      <h3 className="planning-sidebar__zone-heading">{label}</h3>
      {children}
    </div>
  );
}

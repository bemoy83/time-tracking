import { useMemo } from 'react';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import {
  isPlanWrapUpEligible,
  isPlanArchived,
  sortPlansForSidebar,
} from '../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from './hooks/usePlanIdsWithImportedExecutionReturns';
import { ChevronIcon, ChevronRightIcon, TrashIcon, PlusIcon } from '../../components/icons';
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
  /** Controls archive zone collapsed state (sidebar mode). */
  archiveExpanded?: boolean;
  /** Callback to toggle archive zone collapsed state. */
  onToggleArchive?: () => void;
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
  archiveExpanded = false,
  onToggleArchive,
}: PlanListProps) {
  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();

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
      activePlans: sortPlansForSidebar(active, tasks, planIdsWithImportedExecutionReturns),
      archivedPlans: archived.sort((a, b) =>
        (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''),
      ),
    };
  }, [plans, tasks, planIdsWithImportedExecutionReturns]);

  if (sidebarMode) {
    return (
      <div className="planning-view planning-view--sidebar">
        {/* Primary create action */}
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
              planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
              compact
            />
          </SidebarZone>
        )}

        {/* Archive zone — collapsible */}
        {archivedPlans.length > 0 && (
          <SidebarZone
            label={`Archive (${archivedPlans.length})`}
            collapsible
            expanded={archiveExpanded}
            onToggle={onToggleArchive}
          >
            <PlanItems
              plans={archivedPlans}
              tasks={tasks}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpenWrapUp={onOpenWrapUp}
              planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
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
                  planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
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
                    planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
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
  planIdsWithImportedExecutionReturns: Set<string>;
  compact?: boolean;
}

function PlanItems({
  plans,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  planIdsWithImportedExecutionReturns,
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
          planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
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
  planIdsWithImportedExecutionReturns: Set<string>;
  compact?: boolean;
}

function PlanListItem({
  plan,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  planIdsWithImportedExecutionReturns,
  compact,
}: PlanListItemProps) {
  const wrapUpEligible = isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id));
  const badgeVariant = plan.reviewedAt != null
    ? 'reviewed'
    : wrapUpEligible
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
      {wrapUpEligible && (
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

function SidebarZone({
  label,
  children,
  collapsible = false,
  expanded = true,
  onToggle,
}: {
  label: string;
  children: React.ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <div className="planning-sidebar__zone">
        <button
          type="button"
          className="planning-sidebar__zone-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronIcon
            className={`planning-sidebar__zone-chevron${expanded ? ' planning-sidebar__zone-chevron--expanded' : ''}`}
          />
          <span className="planning-sidebar__zone-heading">{label}</span>
        </button>
        {expanded && children}
      </div>
    );
  }

  return (
    <div className="planning-sidebar__zone">
      <h3 className="planning-sidebar__zone-heading">{label}</h3>
      {children}
    </div>
  );
}

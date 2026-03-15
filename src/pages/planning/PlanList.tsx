import { useMemo } from 'react';
import { getPlanDisplayName, type Plan } from '../../lib/planning/plan-model';
import type { Project, Task } from '../../lib/types';
import {
  isPlanWrapUpEligible,
  isPlanArchived,
  isPlanInPlannerState,
  sortPlansForSidebar,
} from '../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from './hooks/usePlanIdsWithImportedExecutionReturns';
import {
  ChevronRightIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  CompleteCircleIcon,
  PencilIcon,
  PlayIcon,
} from '../../components/icons';
import { SidebarZone } from './SidebarZone';
import { Fab } from '../../components/Fab';
import { StatusBadge } from '../../components/StatusBadge';
import { AddToScheduleButton } from './AddToScheduleButton';

interface PlanListProps {
  plans: Plan[];
  projects: Project[];
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
  /** When true, each item shows an add-to-schedule button (sidebar mode). */
  showAddToScheduleButton?: boolean;
  /** Selected plan IDs for shared schedule (when showAddToScheduleButton is true). */
  selectedPlanIdsForSharedSchedule?: Set<string>;
  /** Callback when shared schedule selection changes. */
  onSelectedPlanIdsChange?: (planIds: Set<string>) => void;
}

export function PlanList({
  plans,
  projects,
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
  showAddToScheduleButton = false,
  selectedPlanIdsForSharedSchedule,
  onSelectedPlanIdsChange,
}: PlanListProps) {
  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

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
              projectById={projectById}
              tasks={tasks}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpenWrapUp={onOpenWrapUp}
              planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
              compact
              showAddToScheduleButton={showAddToScheduleButton}
              selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
              onSelectedPlanIdsChange={onSelectedPlanIdsChange}
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
              projectById={projectById}
              tasks={tasks}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpenWrapUp={onOpenWrapUp}
              planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
              compact
              showAddToScheduleButton={showAddToScheduleButton}
              selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
              onSelectedPlanIdsChange={onSelectedPlanIdsChange}
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
        <div className="empty-state">
          <PencilIcon className="empty-state__icon" />
          <p className="empty-state__heading">No plans yet</p>
          <p className="empty-state__text">Create one to get started.</p>
        </div>
      ) : (
        <>
          {activePlans.length > 0 && (
            <ul className="planning-view__list">
              {activePlans.map((plan) => (
                <PlanListItem
                  key={plan.id}
                  plan={plan}
                  projectById={projectById}
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
                    projectById={projectById}
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
  projectById: Map<string, Project>;
  tasks: Task[];
  selectedPlanId?: string | null;
  onSelect: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  planIdsWithImportedExecutionReturns: Set<string>;
  compact?: boolean;
  showAddToScheduleButton?: boolean;
  selectedPlanIdsForSharedSchedule?: Set<string>;
  onSelectedPlanIdsChange?: (planIds: Set<string>) => void;
}

function PlanItems({
  plans,
  projectById,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  planIdsWithImportedExecutionReturns,
  compact,
  showAddToScheduleButton,
  selectedPlanIdsForSharedSchedule,
  onSelectedPlanIdsChange,
}: PlanItemsProps) {
  return (
    <ul className={`planning-view__list${compact ? ' planning-view__list--compact' : ''}`}>
      {plans.map((plan) => (
        <PlanListItem
          key={plan.id}
          plan={plan}
          projectById={projectById}
          tasks={tasks}
          selectedPlanId={selectedPlanId}
          onSelect={onSelect}
          onDelete={onDelete}
          onOpenWrapUp={onOpenWrapUp}
          planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
          compact={compact}
          showAddToScheduleButton={showAddToScheduleButton}
          selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
          onSelectedPlanIdsChange={onSelectedPlanIdsChange}
        />
      ))}
    </ul>
  );
}

interface PlanListItemProps {
  plan: Plan;
  projectById: Map<string, Project>;
  tasks: Task[];
  selectedPlanId?: string | null;
  onSelect: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  planIdsWithImportedExecutionReturns: Set<string>;
  compact?: boolean;
  showAddToScheduleButton?: boolean;
  selectedPlanIdsForSharedSchedule?: Set<string>;
  onSelectedPlanIdsChange?: (planIds: Set<string>) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  'review-ready': 'Review ready',
  reviewed: 'Reviewed',
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPlanDateRange(plan: Plan): string | null {
  const start = plan.assemblyStartDate ?? plan.eventStartDate;
  const end = plan.dismantleEndDate ?? plan.eventEndDate;
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return formatDate(start);
  return formatDate(end!);
}

function PlanStatusIcon({
  variant,
}: {
  variant: 'draft' | 'active' | 'review-ready' | 'reviewed';
}) {
  const title = STATUS_LABELS[variant] ?? variant;
  const iconClass = `planning-view__status-icon planning-view__status-icon--${variant}`;
  const Icon =
    variant === 'reviewed'
      ? CompleteCircleIcon
      : variant === 'review-ready'
        ? CheckIcon
        : variant === 'active'
          ? PlayIcon
          : PencilIcon;
  return (
    <span
      className={iconClass}
      title={title}
      role="img"
      aria-label={title}
    >
      <Icon className="planning-view__status-icon-svg" aria-hidden />
    </span>
  );
}

function PlanListItem({
  plan,
  projectById,
  tasks,
  selectedPlanId,
  onSelect,
  onDelete,
  onOpenWrapUp,
  planIdsWithImportedExecutionReturns,
  compact,
  showAddToScheduleButton,
  selectedPlanIdsForSharedSchedule,
  onSelectedPlanIdsChange,
}: PlanListItemProps) {
  const displayName = getPlanDisplayName(
    plan,
    plan.projectId ? projectById.get(plan.projectId) ?? null : null,
  );
  const wrapUpEligible = isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id));
  const showAddButton =
    showAddToScheduleButton &&
    selectedPlanIdsForSharedSchedule != null &&
    onSelectedPlanIdsChange != null &&
    isPlanInPlannerState(plan);
  const isChecked = selectedPlanIdsForSharedSchedule?.has(plan.id) ?? false;

  const handleToggleAddToSchedule = () => {
    if (!onSelectedPlanIdsChange || selectedPlanIdsForSharedSchedule == null) return;
    const next = new Set(selectedPlanIdsForSharedSchedule);
    if (isChecked) next.delete(plan.id);
    else next.add(plan.id);
    onSelectedPlanIdsChange(next);
  };

  const badgeVariant = plan.reviewedAt != null
    ? 'reviewed'
    : wrapUpEligible
      ? 'review-ready'
      : plan.status;

  const rowClassName = [
    'planning-view__row',
    selectedPlanId === plan.id ? 'planning-view__row--selected' : '',
    compact ? `planning-view__row--status-${plan.status}` : '',
  ].filter(Boolean).join(' ');

  const dateRange = compact ? getPlanDateRange(plan) : null;

  const itemContent = (
    <>
      <button className="planning-view__item-btn" onClick={() => onSelect(plan)}>
        <span className="planning-view__item-content">
          <span className="planning-view__item-title">{displayName}</span>
          {compact ? (
            dateRange && <span className="planning-view__item-date mono">{dateRange}</span>
          ) : (
            <span className="planning-view__item-meta">
              {plan.lineItems.length} {plan.lineItems.length === 1 ? 'package' : 'packages'}
            </span>
          )}
        </span>
        {compact ? (
          <span className="planning-view__item-badges">
            <PlanStatusIcon
              variant={
                badgeVariant === 'reviewed'
                  ? 'reviewed'
                  : badgeVariant === 'review-ready'
                    ? 'review-ready'
                    : badgeVariant === 'active'
                      ? 'active'
                      : 'draft'
              }
            />
          </span>
        ) : (
          <StatusBadge variant={badgeVariant} />
        )}
        {!compact && <ChevronRightIcon className="planning-view__item-chevron" />}
      </button>
      {wrapUpEligible && (
        compact ? (
          <button
            type="button"
            className="planning-view__item-wrap-up-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenWrapUp(plan);
            }}
            aria-label={`Wrap up ${displayName}`}
            title="Wrap up"
          >
            <CheckIcon className="planning-view__item-wrap-up-icon" />
          </button>
        ) : (
          <StatusBadge
            variant="wrap-up"
            as="button"
            onClick={() => onOpenWrapUp(plan)}
            aria-label={`Wrap up ${displayName}`}
          >
            Wrap Up
          </StatusBadge>
        )
      )}
      <button
        className="planning-view__item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(plan.id);
        }}
        aria-label={`Delete ${displayName}`}
      >
        <TrashIcon className="planning-view__item-delete-icon" />
      </button>
    </>
  );

  return (
    <li className={rowClassName}>
      <div className="planning-view__item">{itemContent}</div>
      {showAddButton && (
        <AddToScheduleButton
          planId={plan.id}
          planTitle={displayName}
          isChecked={isChecked}
          onToggle={handleToggleAddToSchedule}
        />
      )}
    </li>
  );
}

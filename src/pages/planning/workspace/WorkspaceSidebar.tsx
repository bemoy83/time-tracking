import { useMemo, useState, useCallback } from 'react';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import type { Project, Task } from '../../../lib/types';
import { isPlanArchived, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from '../hooks/usePlanIdsWithImportedExecutionReturns';
import { groupPlans } from '../planning-list-groups';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { useScheduleEditContext } from './ScheduleEditContext';
import { SidebarScheduleInputs } from '../schedule/SidebarScheduleInputs';
import { WorkCalendarEditor } from '../schedule/WorkCalendarEditor';
import { ThumbCalendar } from '../schedule/ThumbCalendar';
import {
  PlusIcon,
  CalendarIcon,
  ChevronIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlayIcon,
  CheckIcon,
  CompleteCircleIcon,
  TrashIcon,
} from '../../../components/icons';
import { readLocalStorage, writeLocalStorage } from '../../../lib/localStorage';

interface GroupState {
  drafts: boolean;
  ready: boolean;
  inprogress: boolean;
  completed: boolean;
}

export interface WorkspaceSidebarProps {
  plans: Plan[];
  projects: Project[];
  tasks: Task[];
  activePlan: Plan | null;
  activeTab: WorkspaceTab;
  onSelectPlan: (plan: Plan) => void;
  onCreatePlan: () => void;
  onDeletePlan: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  onExit: () => void;
  footer?: React.ReactNode;
  showAddToScheduleButton?: boolean;
  selectedPlanIdsForSharedSchedule?: Set<string>;
  onSelectedPlanIdsChange?: (planIds: Set<string>) => void;
}

export function WorkspaceSidebar({
  plans,
  projects,
  tasks,
  activePlan,
  activeTab,
  onSelectPlan,
  onCreatePlan,
  onDeletePlan,
  onOpenWrapUp,
  onExit,
  footer,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(() =>
    readLocalStorage('workspace-sidebar-collapsed', false),
  );
  const [groupState, setGroupState] = useState<GroupState>(() =>
    readLocalStorage('workspace-sidebar-groups', {
      drafts: true,
      ready: true,
      inprogress: true,
      completed: false,
    }),
  );
  const [mode, setMode] = useState<'list' | 'detail'>('list');
  const [drillPlanId, setDrillPlanId] = useState<string | null>(null);

  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const { inProgressPlans, readyPlans, draftPlans, archivedPlans } = useMemo(
    () => groupPlans(plans, tasks, planIdsWithImportedExecutionReturns),
    [plans, tasks, planIdsWithImportedExecutionReturns],
  );

  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeLocalStorage('workspace-sidebar-collapsed', next);
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((key: keyof GroupState) => {
    setGroupState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeLocalStorage('workspace-sidebar-groups', next);
      return next;
    });
  }, []);

  const handleDrillIn = useCallback(
    (plan: Plan) => {
      if (activePlan?.id !== plan.id) {
        onSelectPlan(plan);
      }
      setCollapsed(false);
      writeLocalStorage('workspace-sidebar-collapsed', false);
      setDrillPlanId(plan.id);
      setMode('detail');
    },
    [activePlan, onSelectPlan],
  );

  const handleBackToList = useCallback(() => {
    setMode('list');
    setDrillPlanId(null);
  }, []);

  const drillPlan = useMemo(
    () => (drillPlanId ? plans.find((p) => p.id === drillPlanId) ?? null : null),
    [drillPlanId, plans],
  );

  const showDrillIcon = activeTab === 'schedule';

  const sidebarClass = [
    'planning-workspace__sidebar',
    'workspace-sidebar',
    collapsed ? 'workspace-sidebar--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={sidebarClass}>
      {/* Header */}
      <div className="workspace-sidebar__header">
        {!collapsed && (
          <button
            type="button"
            className="planning-workspace__exit"
            onClick={onExit}
            aria-label="Exit workspace"
          >
            <span>Exit workspace</span>
          </button>
        )}
        <div className="workspace-sidebar__header-actions">
          {!collapsed && (
            <button
              type="button"
              className="workspace-sidebar__create-btn"
              onClick={onCreatePlan}
              aria-label="New plan"
              title="New plan"
            >
              <PlusIcon className="workspace-sidebar__action-icon" />
            </button>
          )}
          <button
            type="button"
            className="workspace-sidebar__collapse-btn"
            onClick={handleToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon className="workspace-sidebar__collapse-icon" />
            ) : (
              <ChevronLeftIcon className="workspace-sidebar__collapse-icon" />
            )}
          </button>
        </div>
      </div>

      {collapsed ? (
        /* Collapsed rail: status dots for selected plan + create button */
        <div className="workspace-sidebar__rail">
          <button
            type="button"
            className="workspace-sidebar__rail-create"
            onClick={onCreatePlan}
            aria-label="New plan"
            title="New plan"
          >
            <PlusIcon className="workspace-sidebar__rail-icon" />
          </button>
          {activePlan && (
            <button
              type="button"
              className="workspace-sidebar__rail-item workspace-sidebar__rail-item--selected"
              onClick={() => onSelectPlan(activePlan)}
              aria-label={getPlanDisplayName(activePlan, null)}
              title={getPlanDisplayName(activePlan, null)}
            >
              <SidebarStatusDot
                plan={activePlan}
                tasks={tasks}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
              />
            </button>
          )}
        </div>
      ) : mode === 'detail' && drillPlan ? (
        /* Detail mode: schedule inputs + work calendar (wired via ScheduleEditContext in Step 4) */
        <div className="workspace-sidebar__detail">
          <div className="workspace-sidebar__detail-header">
            <button
              type="button"
              className="workspace-sidebar__back-btn"
              onClick={handleBackToList}
              aria-label="Back to plan list"
            >
              <ChevronLeftIcon className="workspace-sidebar__back-icon" />
              <span>Plans</span>
            </button>
            <span className="workspace-sidebar__detail-title">
              {getPlanDisplayName(
                drillPlan,
                drillPlan.projectId ? (projectById.get(drillPlan.projectId) ?? null) : null,
              )}
            </span>
          </div>
          <div className="workspace-sidebar__detail-body">
            <DrillInContent />
          </div>
        </div>
      ) : (
        /* List mode: search + accordion groups */
        <>
          <div className="workspace-sidebar__search">
            <input
              type="search"
              className="workspace-sidebar__search-input"
              placeholder="Search plans…"
              aria-label="Search plans"
            />
          </div>
          <div className="workspace-sidebar__groups">
            {inProgressPlans.length > 0 && (
              <PlanGroup
                label="In Progress"
                plans={inProgressPlans}
                expanded={groupState.inprogress}
                onToggle={() => handleToggleGroup('inprogress')}
                activePlanId={activePlan?.id ?? null}
                projectById={projectById}
                tasks={tasks}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                showDrillIcon={showDrillIcon}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onDeletePlan={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            )}
            {readyPlans.length > 0 && (
              <PlanGroup
                label="Ready"
                plans={readyPlans}
                expanded={groupState.ready}
                onToggle={() => handleToggleGroup('ready')}
                activePlanId={activePlan?.id ?? null}
                projectById={projectById}
                tasks={tasks}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                showDrillIcon={showDrillIcon}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onDeletePlan={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            )}
            {draftPlans.length > 0 && (
              <PlanGroup
                label="Drafts"
                plans={draftPlans}
                expanded={groupState.drafts}
                onToggle={() => handleToggleGroup('drafts')}
                activePlanId={activePlan?.id ?? null}
                projectById={projectById}
                tasks={tasks}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                showDrillIcon={showDrillIcon}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onDeletePlan={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            )}
            {archivedPlans.length > 0 && (
              <PlanGroup
                label={`Completed (${archivedPlans.length})`}
                plans={archivedPlans}
                expanded={groupState.completed}
                onToggle={() => handleToggleGroup('completed')}
                activePlanId={activePlan?.id ?? null}
                projectById={projectById}
                tasks={tasks}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                showDrillIcon={false}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onDeletePlan={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            )}
            {plans.length === 0 && (
              <p className="workspace-sidebar__empty">No plans yet.</p>
            )}
          </div>
        </>
      )}

      {footer && (
        <div className="planning-workspace__sidebar-footer">{footer}</div>
      )}
    </aside>
  );
}

// ---- Drill-in detail content (consumes ScheduleEditContext) ----

function DrillInContent() {
  const ctx = useScheduleEditContext();

  if (!ctx) {
    return (
      <p className="workspace-sidebar__detail-placeholder">
        Open the Schedule tab to edit schedule configuration.
      </p>
    );
  }

  const { currentPlan, phaseDates, workCalendarRange, primaryRange, effectiveCrewSize, readOnly } = ctx;

  return (
    <>
      <SidebarScheduleInputs
        assemblyStartDate={phaseDates.assemblyStartDate}
        assemblyEndDate={phaseDates.assemblyEndDate}
        dismantleStartDate={phaseDates.dismantleStartDate}
        dismantleEndDate={phaseDates.dismantleEndDate}
        eventStartDate={currentPlan.eventStartDate}
        eventEndDate={currentPlan.eventEndDate}
        defaultCrewSize={currentPlan.defaultCrewSize}
        defaultEfficiency={currentPlan.defaultEfficiency}
        readOnly={readOnly}
        primaryRange={workCalendarRange ?? primaryRange}
        onPhaseDateChange={ctx.onPhaseDateChange}
        onEventDateChange={ctx.onEventDateChange}
        onDefaultCrewSizeChange={ctx.onDefaultCrewChange}
        onDefaultEfficiencyChange={ctx.onDefaultEfficiencyChange}
      />
      <WorkCalendarEditor
        calendar={currentPlan.workCalendar}
        readOnly={readOnly}
        onUpdateDay={ctx.onUpdateCalendarDay}
        planDefaultCrewSize={effectiveCrewSize ?? currentPlan.defaultCrewSize}
      />
      {currentPlan.workCalendar.length > 0 && (
        <div className="workspace-sidebar__drill-section">
          <span className="workspace-sidebar__drill-section-label">Overview</span>
          <ThumbCalendar
            calendar={currentPlan.workCalendar}
            phaseDates={phaseDates}
          />
        </div>
      )}
    </>
  );
}

// ---- Status dot ----

function SidebarStatusDot({
  plan,
  tasks,
  planIdsWithImportedExecutionReturns,
}: {
  plan: Plan;
  tasks: Task[];
  planIdsWithImportedExecutionReturns: Set<string>;
}) {
  const wrapUpEligible = isPlanWrapUpEligible(
    plan,
    tasks,
    planIdsWithImportedExecutionReturns.has(plan.id),
  );
  const variant = isPlanArchived(plan)
    ? 'reviewed'
    : wrapUpEligible
      ? 'review-ready'
      : plan.status === 'active'
        ? 'ready'
        : 'draft';
  return <StatusDot variant={variant} />;
}

function StatusDot({
  variant,
}: {
  variant: 'draft' | 'ready' | 'review-ready' | 'reviewed';
}) {
  const Icon =
    variant === 'reviewed'
      ? CompleteCircleIcon
      : variant === 'review-ready'
        ? CheckIcon
        : variant === 'ready'
          ? PlayIcon
          : PencilIcon;
  return (
    <span
      className={`planning-view__status-icon planning-view__status-icon--${variant}`}
      aria-hidden
    >
      <Icon className="planning-view__status-icon-svg" aria-hidden />
    </span>
  );
}

// ---- Plan group accordion ----

interface PlanGroupProps {
  label: string;
  plans: Plan[];
  expanded: boolean;
  onToggle: () => void;
  activePlanId: string | null;
  projectById: Map<string, Project>;
  tasks: Task[];
  planIdsWithImportedExecutionReturns: Set<string>;
  showDrillIcon: boolean;
  onSelectPlan: (plan: Plan) => void;
  onDrillIn: (plan: Plan) => void;
  onDeletePlan: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
}

function PlanGroup({
  label,
  plans,
  expanded,
  onToggle,
  activePlanId,
  projectById,
  tasks,
  planIdsWithImportedExecutionReturns,
  showDrillIcon,
  onSelectPlan,
  onDrillIn,
  onDeletePlan,
  onOpenWrapUp,
}: PlanGroupProps) {
  return (
    <div className={`plan-group${expanded ? ' plan-group--expanded' : ''}`}>
      <button
        type="button"
        className="plan-group__header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ChevronIcon
          className={`plan-group__chevron${expanded ? ' plan-group__chevron--expanded' : ''}`}
        />
        <span className="plan-group__label">{label}</span>
        <span className="plan-group__count">{plans.length}</span>
      </button>
      {expanded && (
        <div className="plan-group__body">
          <ul className="plan-list">
            {plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                projectById={projectById}
                tasks={tasks}
                isSelected={activePlanId === plan.id}
                planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                showDrillIcon={showDrillIcon}
                onSelect={onSelectPlan}
                onDrillIn={onDrillIn}
                onDelete={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Plan row ----

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getPlanDateRange(plan: Plan): string | null {
  const start = plan.assemblyStartDate ?? plan.eventStartDate;
  const end = plan.dismantleEndDate ?? plan.eventEndDate;
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return formatDate(start);
  return formatDate(end!);
}

interface PlanRowProps {
  plan: Plan;
  projectById: Map<string, Project>;
  tasks: Task[];
  isSelected: boolean;
  planIdsWithImportedExecutionReturns: Set<string>;
  showDrillIcon: boolean;
  onSelect: (plan: Plan) => void;
  onDrillIn: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
}

function PlanRow({
  plan,
  projectById,
  tasks,
  isSelected,
  planIdsWithImportedExecutionReturns,
  showDrillIcon,
  onSelect,
  onDrillIn,
  onDelete,
  onOpenWrapUp,
}: PlanRowProps) {
  const displayName = getPlanDisplayName(
    plan,
    plan.projectId ? (projectById.get(plan.projectId) ?? null) : null,
  );
  const archived = isPlanArchived(plan);
  const wrapUpEligible = isPlanWrapUpEligible(
    plan,
    tasks,
    planIdsWithImportedExecutionReturns.has(plan.id),
  );
  const dateRange = getPlanDateRange(plan);

  const statusVariant = archived
    ? 'reviewed'
    : wrapUpEligible
      ? 'review-ready'
      : plan.status === 'active'
        ? 'ready'
        : 'draft';

  const rowClass = [
    'plan-row',
    isSelected ? 'plan-row--selected' : '',
    plan.status === 'draft' ? 'plan-row--draft' : '',
    archived ? 'plan-row--completed' : '',
    plan.handedOffAt != null && !archived ? 'plan-row--inprogress' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={rowClass}>
      <div className="plan-row__item">
        <button
          type="button"
          className="plan-row__btn"
          onClick={() => onSelect(plan)}
          aria-current={isSelected ? 'page' : undefined}
        >
          <StatusDot variant={statusVariant} />
          <span className="plan-row__content">
            <span className="plan-row__title">{displayName}</span>
            {dateRange && <span className="plan-row__date mono">{dateRange}</span>}
          </span>
        </button>
        {wrapUpEligible && (
          <button
            type="button"
            className="plan-row__wrapup-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenWrapUp(plan);
            }}
            aria-label={`Wrap up ${displayName}`}
            title="Wrap up"
          >
            <CheckIcon className="plan-row__wrapup-icon" />
          </button>
        )}
        {showDrillIcon && (
          <button
            type="button"
            className="plan-row__drill"
            onClick={(e) => {
              e.stopPropagation();
              onDrillIn(plan);
            }}
            aria-label={`Schedule details for ${displayName}`}
            title="Schedule details"
          >
            <CalendarIcon className="plan-row__drill-icon" />
          </button>
        )}
        <button
          type="button"
          className="plan-row__delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(plan.id);
          }}
          aria-label={`Delete ${displayName}`}
          title="Delete"
        >
          <TrashIcon className="plan-row__delete-icon" />
        </button>
      </div>
    </li>
  );
}

import { useMemo, useState, useCallback } from 'react';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import { getProjectDisplayColor, type Project, type Task } from '../../../lib/types';
import { isPlanArchived, isPlanInPlannerState, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from '../hooks/usePlanIdsWithImportedExecutionReturns';
import { groupPlans } from '../planning-list-groups';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { useScheduleEditContext } from './ScheduleEditContext';
import { useSharedScheduleContext } from './SharedScheduleContext';
import { SidebarScheduleInputs } from '../schedule/SidebarScheduleInputs';
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
  selectedPlanIdsForSharedSchedule: Set<string>;
  onSelectedPlanIdsChange: (planIds: Set<string>) => void;
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
  selectedPlanIdsForSharedSchedule,
  onSelectedPlanIdsChange,
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
  const railPlans = useMemo(
    () => [...inProgressPlans, ...readyPlans, ...draftPlans, ...archivedPlans],
    [inProgressPlans, readyPlans, draftPlans, archivedPlans],
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
  const showSharedScheduleSelector = activeTab === 'shared-schedule';

  const handleToggleSharedSchedulePlan = useCallback(
    (plan: Plan) => {
      if (!isPlanInPlannerState(plan)) return;
      const next = new Set(selectedPlanIdsForSharedSchedule);
      if (next.has(plan.id)) next.delete(plan.id);
      else next.add(plan.id);
      onSelectedPlanIdsChange(next);
    },
    [onSelectedPlanIdsChange, selectedPlanIdsForSharedSchedule],
  );

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
        /* Collapsed rail: all plans + create button */
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
          {railPlans.map((plan) => {
            const project = plan.projectId ? projectById.get(plan.projectId) : undefined;
            const accentColor = project ? getProjectDisplayColor(project.color) : null;
            const displayName = getPlanDisplayName(plan, project ?? null);
            const isSelected = showSharedScheduleSelector
              ? selectedPlanIdsForSharedSchedule.has(plan.id)
              : activePlan?.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                className={`workspace-sidebar__rail-item${isSelected ? ' workspace-sidebar__rail-item--selected' : ''}${accentColor ? ' workspace-sidebar__rail-item--has-project' : ''}`}
                style={accentColor ? { '--workspace-sidebar-rail-accent': accentColor } as React.CSSProperties : undefined}
                onClick={() => {
                  if (showSharedScheduleSelector) {
                    handleToggleSharedSchedulePlan(plan);
                    return;
                  }
                  onSelectPlan(plan);
                }}
                aria-label={
                  showSharedScheduleSelector
                    ? `${isSelected ? 'Remove' : 'Add'} ${displayName} ${isSelected ? 'from' : 'to'} shared schedule`
                    : displayName
                }
                aria-pressed={showSharedScheduleSelector ? isSelected : undefined}
                title={
                  showSharedScheduleSelector
                    ? `${isSelected ? 'Remove from' : 'Add to'} shared schedule`
                    : displayName
                }
              >
                <SidebarStatusDot
                  plan={plan}
                  tasks={tasks}
                  planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
                />
              </button>
            );
          })}
        </div>
      ) : mode === 'detail' && drillPlan ? (
        /* Detail mode: schedule inputs + thumb calendar */
        <div className="workspace-sidebar__detail">
          <div className="workspace-sidebar__detail-header">
            <button
              type="button"
              className="workspace-sidebar__back-btn"
              onClick={handleBackToList}
              aria-label="Back to plan list"
            >
              <ChevronLeftIcon className="workspace-sidebar__back-icon" />
            </button>
            <span className="workspace-sidebar__detail-title">
              {getPlanDisplayName(
                drillPlan,
                drillPlan.projectId ? (projectById.get(drillPlan.projectId) ?? null) : null,
              )}
            </span>
            <span className={`workspace-sidebar__detail-badge workspace-sidebar__detail-badge--${isPlanArchived(drillPlan) ? 'archived' : drillPlan.status}`}>
              {isPlanArchived(drillPlan) ? 'Done' : drillPlan.status === 'active' ? 'Active' : 'Draft'}
            </span>
          </div>
          <div className="workspace-sidebar__detail-body">
            <DrillInContent />
          </div>
        </div>
      ) : (
        /* List mode: new plan pill + search + accordion groups */
        <>
          <div className="workspace-sidebar__list-top">
            <button
              type="button"
              className="workspace-sidebar__new-plan-pill"
              onClick={onCreatePlan}
              aria-label="New plan"
            >
              <PlusIcon className="workspace-sidebar__new-plan-pill-icon" />
              New Plan
            </button>
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
                showSharedScheduleSelector={showSharedScheduleSelector}
                selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onToggleSharedSchedulePlan={handleToggleSharedSchedulePlan}
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
                showSharedScheduleSelector={showSharedScheduleSelector}
                selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onToggleSharedSchedulePlan={handleToggleSharedSchedulePlan}
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
                showSharedScheduleSelector={showSharedScheduleSelector}
                selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onToggleSharedSchedulePlan={handleToggleSharedSchedulePlan}
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
                showSharedScheduleSelector={showSharedScheduleSelector}
                selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
                onSelectPlan={onSelectPlan}
                onDrillIn={handleDrillIn}
                onToggleSharedSchedulePlan={handleToggleSharedSchedulePlan}
                onDeletePlan={onDeletePlan}
                onOpenWrapUp={onOpenWrapUp}
              />
            )}
            {plans.length === 0 && (
              <p className="workspace-sidebar__empty">No plans yet.</p>
            )}
          </div>
          {showSharedScheduleSelector && <CrewPoolSidebarSection />}
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

  const { currentPlan, phaseDates, workCalendarRange, primaryRange, readOnly } = ctx;

  return (
    <>
      <div className="workspace-sidebar__drill-section">
        <span className="workspace-sidebar__drill-section-label">Schedule Inputs</span>
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
      </div>
      {currentPlan.workCalendar.length > 0 && (
        <div className="workspace-sidebar__drill-section">
          <span className="workspace-sidebar__drill-section-label">Work Calendar</span>
          <ThumbCalendar
            calendar={currentPlan.workCalendar}
            phaseDates={phaseDates}
          />
        </div>
      )}
    </>
  );
}

// ---- Crew pool (shared schedule) ----

function CrewPoolSidebarSection() {
  const ctx = useSharedScheduleContext();
  if (!ctx) return null;

  return (
    <div className="workspace-sidebar__crew-pool">
      <span className="workspace-sidebar__drill-section-label">Crew Pool</span>
      <div className="workspace-sidebar__crew-pool-body">
        <label className="workspace-sidebar__crew-pool-field">
          <span className="workspace-sidebar__crew-pool-label">Default crew</span>
          <input
            type="number"
            className="input input--sm"
            min={0}
            step={1}
            value={ctx.crewPoolDefaultCrewSize}
            onChange={(e) => ctx.onDefaultCrewSizeChange(e.target.value)}
          />
        </label>
      </div>
    </div>
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
  showSharedScheduleSelector: boolean;
  selectedPlanIdsForSharedSchedule: Set<string>;
  onSelectPlan: (plan: Plan) => void;
  onDrillIn: (plan: Plan) => void;
  onToggleSharedSchedulePlan: (plan: Plan) => void;
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
  showSharedScheduleSelector,
  selectedPlanIdsForSharedSchedule,
  onSelectPlan,
  onDrillIn,
  onToggleSharedSchedulePlan,
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
                showSharedScheduleSelector={showSharedScheduleSelector}
                isSharedScheduleSelected={selectedPlanIdsForSharedSchedule.has(plan.id)}
                onSelect={onSelectPlan}
                onDrillIn={onDrillIn}
                onToggleSharedSchedule={onToggleSharedSchedulePlan}
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
  showSharedScheduleSelector: boolean;
  isSharedScheduleSelected: boolean;
  onSelect: (plan: Plan) => void;
  onDrillIn: (plan: Plan) => void;
  onToggleSharedSchedule: (plan: Plan) => void;
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
  showSharedScheduleSelector,
  isSharedScheduleSelected,
  onSelect,
  onDrillIn,
  onToggleSharedSchedule,
  onDelete,
  onOpenWrapUp,
}: PlanRowProps) {
  const displayName = getPlanDisplayName(
    plan,
    plan.projectId ? (projectById.get(plan.projectId) ?? null) : null,
  );
  const project = plan.projectId ? projectById.get(plan.projectId) : undefined;
  const projectAccentColor = project ? getProjectDisplayColor(project.color) : null;
  const archived = isPlanArchived(plan);
  const isSharedScheduleSelectable = isPlanInPlannerState(plan);
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
    projectAccentColor ? 'plan-row--has-project' : '',
    isSelected ? 'plan-row--selected' : '',
    plan.status === 'draft' ? 'plan-row--draft' : '',
    archived ? 'plan-row--completed' : '',
    plan.handedOffAt != null && !archived ? 'plan-row--inprogress' : '',
    showSharedScheduleSelector ? 'plan-row--shared-schedule' : '',
    isSharedScheduleSelected ? 'plan-row--shared-selected' : '',
    showSharedScheduleSelector && !isSharedScheduleSelectable ? 'plan-row--shared-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={rowClass}
      style={projectAccentColor ? { '--plan-row-accent': projectAccentColor } as React.CSSProperties : undefined}
    >
      <div className="plan-row__item">
        {showSharedScheduleSelector && (
          <button
            type="button"
            className="plan-row__shared-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSharedSchedule(plan);
            }}
            aria-pressed={isSharedScheduleSelected}
            aria-label={`${isSharedScheduleSelected ? 'Remove' : 'Add'} ${displayName} ${isSharedScheduleSelected ? 'from' : 'to'} shared schedule`}
            title={isSharedScheduleSelected ? 'Remove from shared schedule' : 'Add to shared schedule'}
            disabled={!isSharedScheduleSelectable}
          >
            {isSharedScheduleSelected && (
              <CheckIcon className="plan-row__shared-toggle-icon" aria-hidden />
            )}
          </button>
        )}
        <button
          type="button"
          className="plan-row__btn"
          onClick={() => {
            if (showSharedScheduleSelector) {
              onToggleSharedSchedule(plan);
              return;
            }
            onSelect(plan);
          }}
          aria-current={isSelected ? 'page' : undefined}
          aria-pressed={showSharedScheduleSelector ? isSharedScheduleSelected : undefined}
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

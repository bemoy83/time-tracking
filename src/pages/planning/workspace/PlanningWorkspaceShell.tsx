/**
 * PlanningWorkspaceShell — desktop/tablet two-pane layout.
 *
 * Renders a persistent sidebar (plan list) alongside a main content pane.
 * The exit control in the top-left returns the user to the previous app tab.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import type { Task, WorkType } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import type { Project, TimeEntry } from '../../../lib/types';
import { isPlanArchived, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from '../hooks/usePlanIdsWithImportedExecutionReturns';
import { PlanList } from '../PlanList';
import { PlanEditor } from '../PlanEditor';
import { ScheduleView } from '../ScheduleView';
import { SharedScheduleView } from '../SharedScheduleView';
import { ProgressView } from '../ProgressView';
import { InsightsView } from '../InsightsView';
import { EventReportView } from '../EventReportView';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import {
  getVisibleGlobalWorkspaceTabs,
  getVisiblePlanWorkspaceTabs,
  type WorkspaceRenderContext,
} from './workspace-tabs';
import { SidebarIssuesPanel } from './SidebarIssuesPanel';
import { SparklesIcon, TaskListIcon } from '../../../components/icons';
import type { ScheduleIssuePanelPayload } from './schedule-issue-panel-types';
import { WrapUpReviewPane } from '../WrapUpReviewPane';
import { StatusBadge } from '../../../components/StatusBadge';

interface PlanningWorkspaceShellProps {
  // Data
  plans: Plan[];
  tasks: Task[];
  projects: Project[];
  workTypes: WorkType[];
  kpis: WorkTypeKpi[];
  timeEntries: TimeEntry[];
  timeEntriesByTask: Map<string, TimeEntry[]>;

  // Selection
  activePlan: Plan | null;
  activeTab: WorkspaceTab;
  hasLinkedTasks: boolean;
  wrapUpPlan: Plan | null;
  selectedPlanIdsForSharedSchedule: Set<string>;

  // Sidebar preferences
  archiveExpanded: boolean;
  onToggleArchive: () => void;

  // Navigation
  onSelectPlan: (plan: Plan) => void;
  onCreatePlan: () => void;
  onDeletePlan: (id: string) => void;
  onSavePlan: (plan: Plan) => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  onSetSelectedPlanIdsForSharedSchedule: (planIds: Set<string>) => void;
  onOpenInsights: () => void;
  onOpenProgress: () => void;
  onOpenWrapUp: (plan: Plan) => void;
  onCloseWrapUp: () => void;
  onWrapUpCompleted: (plan: Plan, success: boolean) => void;

  // App chrome
  onExit: () => void;
}

export function PlanningWorkspaceShell({
  plans,
  tasks,
  projects,
  workTypes,
  kpis,
  timeEntries,
  timeEntriesByTask,
  activePlan,
  activeTab,
  hasLinkedTasks,
  wrapUpPlan,
  selectedPlanIdsForSharedSchedule,
  archiveExpanded,
  onToggleArchive,
  onSelectPlan,
  onCreatePlan,
  onDeletePlan,
  onSavePlan,
  onSetActiveTab,
  onSetSelectedPlanIdsForSharedSchedule,
  onOpenInsights,
  onOpenProgress,
  onOpenWrapUp,
  onCloseWrapUp,
  onWrapUpCompleted,
  onExit,
}: PlanningWorkspaceShellProps) {
  const [scheduleIssuePanelPayload, setScheduleIssuePanelPayload] = useState<ScheduleIssuePanelPayload | null>(null);
  const isOnIssuesTabRef = useRef(false);
  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();
  const sidebarTabContext: WorkspaceRenderContext = {
    hasLinkedTasks,
    isReviewed: activePlan ? isPlanArchived(activePlan) : false,
    reviewReady: false,
    showScheduleTab: activePlan ? !isPlanArchived(activePlan) : false,
    onOpenProgress,
    onOpenInsights,
    onSetActiveTab,
  };
  const sidebarTabs = getVisibleGlobalWorkspaceTabs(sidebarTabContext);

  isOnIssuesTabRef.current = activeTab === 'issues';

  useEffect(() => {
    if ((activeTab !== 'schedule' && activeTab !== 'issues') || !activePlan) {
      setScheduleIssuePanelPayload(null);
    }
  }, [activePlan, activeTab]);

  const handleScheduleIssuePanelChange = useCallback((payload: ScheduleIssuePanelPayload | null) => {
    // ScheduleView fires null on unmount (cleanup effect). Don't clear payload when
    // the user has switched to the Issues tab — we want to preserve it there.
    if (payload === null && isOnIssuesTabRef.current) return;
    setScheduleIssuePanelPayload(payload);
  }, []);

  return (
    <div className="planning-workspace">
      {/* Sidebar */}
      <aside className="planning-workspace__sidebar">
        <div className="planning-workspace__sidebar-header">
          <button
            type="button"
            className="planning-workspace__exit"
            onClick={onExit}
            aria-label="Exit workspace"
          >
            <span>Exit workspace</span>
          </button>
        </div>
        <div className="planning-workspace__sidebar-content">
          <PlanList
            plans={plans}
            projects={projects}
            tasks={tasks}
            onSelect={onSelectPlan}
            onCreate={onCreatePlan}
            onDelete={onDeletePlan}
            onOpenWrapUp={onOpenWrapUp}
            onOpenInsights={onOpenInsights}
            selectedPlanId={activePlan?.id ?? null}
            sidebarMode
            archiveExpanded={archiveExpanded}
            onToggleArchive={onToggleArchive}
            showAddToScheduleButton={activeTab === 'shared-schedule'}
            selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
            onSelectedPlanIdsChange={onSetSelectedPlanIdsForSharedSchedule}
          />
        </div>
        <div className="planning-workspace__sidebar-footer">
          {sidebarTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`planning-workspace__sidebar-footer-item${activeTab === tab.id ? ' planning-workspace__sidebar-footer-item--active' : ''}`}
              onClick={tab.onSelect}
              aria-label={tab.label}
            >
              {tab.id === 'shared-schedule' ? (
                <TaskListIcon className="planning-workspace__sidebar-footer-icon" />
              ) : (
                <SparklesIcon className="planning-workspace__sidebar-footer-icon" />
              )}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main pane */}
      <section className="planning-workspace__main">
        {wrapUpPlan ? (
          <WrapUpMainPane
            plan={wrapUpPlan}
            tasks={tasks}
            hasLinkedTasks={hasLinkedTasks}
            planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
            onCloseWrapUp={onCloseWrapUp}
            onSetActiveTab={onSetActiveTab}
          >
            <WrapUpReviewPane
              plan={wrapUpPlan}
              tasks={tasks}
              timeEntriesByTask={timeEntriesByTask}
              onClose={onCloseWrapUp}
              onCompleted={onWrapUpCompleted}
            />
          </WrapUpMainPane>
        ) : activeTab === 'shared-schedule' ? (
          <SharedScheduleMainPane
            activeTab={activeTab}
            sidebarTabContext={sidebarTabContext}
          >
            <SharedScheduleView
              plans={plans}
              projects={projects}
              selectedPlanIds={selectedPlanIdsForSharedSchedule}
              onSavePlan={onSavePlan}
            />
          </SharedScheduleMainPane>
        ) : activePlan ? (
          <WorkspaceMainPane
            plan={activePlan}
            activeTab={activeTab}
            tasks={tasks}
            projects={projects}
            workTypes={workTypes}
            kpis={kpis}
            timeEntries={timeEntries}
            timeEntriesByTask={timeEntriesByTask}
            hasLinkedTasks={hasLinkedTasks}
            onSavePlan={onSavePlan}
            onSetActiveTab={onSetActiveTab}
            onOpenProgress={onOpenProgress}
            onOpenWrapUp={onOpenWrapUp}
            onIssuePanelChange={handleScheduleIssuePanelChange}
            scheduleIssuePanelPayload={scheduleIssuePanelPayload}
            planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
          />
        ) : activeTab === 'progress' ? (
          <div className="planning-workspace__main-inner">
            <div className="planning-workspace__tab-content" role="tabpanel">
              <div className="planning-workspace__editor-canvas">
                <div className="planning-workspace__empty">
                  <p className="planning-workspace__empty-heading">No active plan</p>
                  <p className="planning-workspace__empty-desc">Select a plan from the sidebar to view its progress.</p>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'insights' ? (
          <div className="planning-workspace__main-inner">
            <div className="planning-workspace__tab-content" role="tabpanel">
              <div className="planning-workspace__editor-canvas">
                <InsightsView tasks={tasks} workTypes={workTypes} plans={plans} projects={projects} />
              </div>
            </div>
          </div>
        ) : (
          <div className="planning-workspace__empty">
            <TaskListIcon className="planning-workspace__empty-icon" />
            {plans.length === 0 ? (
              <>
                <p className="planning-workspace__empty-heading">Create your first plan</p>
                <p className="planning-workspace__empty-desc">Get started by creating a plan to organise your work packages.</p>
                <button type="button" className="btn btn--primary" onClick={onCreatePlan}>
                  New Plan
                </button>
              </>
            ) : (
              <>
                <p className="planning-workspace__empty-heading">Select a plan to edit</p>
                <p className="planning-workspace__empty-desc">Choose a plan from the sidebar, or create a new one.</p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Wrap-up main pane with tab strip ---

interface WrapUpMainPaneProps {
  plan: Plan;
  tasks: Task[];
  hasLinkedTasks: boolean;
  planIdsWithImportedExecutionReturns: Set<string>;
  onCloseWrapUp: () => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  children: React.ReactNode;
}

function WrapUpMainPane({
  plan,
  tasks,
  hasLinkedTasks,
  planIdsWithImportedExecutionReturns,
  onCloseWrapUp,
  onSetActiveTab,
  children,
}: WrapUpMainPaneProps) {
  const isReviewed = isPlanArchived(plan);
  const wrapUpEligible = isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id));
  const showScheduleTab = !isReviewed;

  const handleTabSelect = useCallback(
    (tab: WorkspaceTab) => {
      if (tab !== 'review') {
        onCloseWrapUp();
        onSetActiveTab(tab);
      }
    },
    [onCloseWrapUp, onSetActiveTab],
  );

  const tabs = getVisiblePlanWorkspaceTabs({
    hasLinkedTasks,
    isReviewed,
    reviewReady: wrapUpEligible,
    onOpenProgress: () => {
      onCloseWrapUp();
      onSetActiveTab('progress');
    },
    onSetActiveTab: handleTabSelect,
    showScheduleTab,
    onOpenInsights: () => {
      onCloseWrapUp();
      onSetActiveTab('insights');
    },
  });

  return (
    <div className="planning-workspace__main-inner">
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab.id}
            activeTab="review"
            onClick={tab.onSelect}
          >
            {tab.label}
          </TabButton>
        ))}
      </nav>
      <div className="planning-workspace__tab-content" role="tabpanel">
        <div className="planning-workspace__editor-canvas planning-workspace__editor-canvas--fill">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Shared Schedule main pane with tab strip ---

interface SharedScheduleMainPaneProps {
  activeTab: WorkspaceTab;
  sidebarTabContext: WorkspaceRenderContext;
  children: React.ReactNode;
}

function SharedScheduleMainPane({
  activeTab,
  sidebarTabContext,
  children,
}: SharedScheduleMainPaneProps) {
  const tabs = getVisibleGlobalWorkspaceTabs(sidebarTabContext);

  return (
    <div className="planning-workspace__main-inner">
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab.id}
            activeTab={activeTab}
            onClick={tab.onSelect}
          >
            {tab.label}
          </TabButton>
        ))}
      </nav>
      <div className="planning-workspace__tab-content" role="tabpanel">
        <div className="planning-workspace__editor-canvas">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Main pane with tab strip ---

function formatContextDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  return fmt(end!);
}

interface WorkspaceMainPaneProps {
  plan: Plan;
  activeTab: WorkspaceTab;
  tasks: Task[];
  projects: Project[];
  workTypes: WorkType[];
  kpis: WorkTypeKpi[];
  timeEntries: TimeEntry[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  hasLinkedTasks: boolean;
  onSavePlan: (plan: Plan) => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  onOpenProgress: () => void;
  onOpenWrapUp: (plan: Plan) => void;
  onIssuePanelChange: (payload: ScheduleIssuePanelPayload | null) => void;
  scheduleIssuePanelPayload: ScheduleIssuePanelPayload | null;
  planIdsWithImportedExecutionReturns: Set<string>;
}

function WorkspaceMainPane({
  plan,
  activeTab,
  tasks,
  projects,
  workTypes,
  kpis,
  timeEntries,
  timeEntriesByTask,
  hasLinkedTasks,
  onSavePlan,
  onSetActiveTab,
  onOpenProgress,
  onOpenWrapUp,
  onIssuePanelChange,
  scheduleIssuePanelPayload,
  planIdsWithImportedExecutionReturns,
}: WorkspaceMainPaneProps) {
  const beforeScheduleTabRef = useRef<(() => Promise<void>) | null>(null);
  const selectedProject = plan.projectId
    ? projects.find((project) => project.id === plan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(plan, selectedProject);

  const isReviewed = isPlanArchived(plan);
  const wrapUpEligible = isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id));
  const showScheduleTab = !isReviewed;
  const effectiveActiveTab: WorkspaceTab =
    activeTab === 'schedule' && !showScheduleTab ? 'edit' : activeTab;

  const handleSetActiveTab = useCallback(
    (tab: WorkspaceTab) => {
      if (tab === 'schedule') {
        void (async () => {
          await (beforeScheduleTabRef.current?.() ?? Promise.resolve());
          onSetActiveTab('schedule');
        })();
      } else {
        onSetActiveTab(tab);
      }
    },
    [onSetActiveTab],
  );

  const tabs = getVisiblePlanWorkspaceTabs({
    hasLinkedTasks,
    isReviewed,
    reviewReady: wrapUpEligible,
    onOpenProgress,
    onSetActiveTab: handleSetActiveTab,
    showScheduleTab,
    onOpenInsights: () => onSetActiveTab('insights'),
  });
  const reviewedDateText = plan.reviewedAt
    ? ` on ${new Date(plan.reviewedAt).toLocaleDateString()}`
    : '';

  const assemblyDateRange = formatContextDateRange(plan.assemblyStartDate, plan.assemblyEndDate);
  const dismantleDateRange = formatContextDateRange(plan.dismantleStartDate, plan.dismantleEndDate);

  return (
    <div className="planning-workspace__main-inner">
      {/* Plan context bar */}
      <div className="planning-workspace__plan-context-bar">
        <span className="planning-workspace__plan-context-title">{planDisplayName}</span>
        <StatusBadge variant={wrapUpEligible ? 'review-ready' : plan.status} />
        {(assemblyDateRange || dismantleDateRange) && (
          <span className="planning-workspace__plan-context-phases">
            {assemblyDateRange && (
              <span className="planning-workspace__plan-context-phase">
                <span className="planning-workspace__plan-context-phase-dot planning-workspace__plan-context-phase-dot--assembly" />
                <span className="mono">{assemblyDateRange}</span>
              </span>
            )}
            {dismantleDateRange && (
              <span className="planning-workspace__plan-context-phase">
                <span className="planning-workspace__plan-context-phase-dot planning-workspace__plan-context-phase-dot--dismantle" />
                <span className="mono">{dismantleDateRange}</span>
              </span>
            )}
          </span>
        )}
      </div>
      {/* Context-aware tab strip */}
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab.id}
            activeTab={effectiveActiveTab}
            onClick={tab.onSelect}
          >
            {tab.label}
          </TabButton>
        ))}
      </nav>

      {/* Tab content */}
      <div className="planning-workspace__tab-content" role="tabpanel">
        {isReviewed && (
          <div className="planning-workspace__reviewed-banner">
            This plan was reviewed and archived{reviewedDateText}.
          </div>
        )}
        {effectiveActiveTab === 'edit' && (
          <div className="planning-workspace__editor-canvas">
            <PlanEditor
              plan={plan}
              kpis={kpis}
              projects={projects}
              canOpenProgress={hasLinkedTasks}
              showBackButton={false}
              readOnly={isReviewed}
              onSave={onSavePlan}
              onBack={() => onSetActiveTab('edit')}
              onOpenSchedule={showScheduleTab ? () => onSetActiveTab('schedule') : undefined}
              onOpenProgress={onOpenProgress}
              onOpenReport={() => onSetActiveTab('report')}
              onRegisterBeforeScheduleSwitch={(fn) => {
                beforeScheduleTabRef.current = fn ?? null;
              }}
            />
          </div>
        )}
        {effectiveActiveTab === 'progress' && (
          <div className="planning-workspace__editor-canvas">
            <ProgressView
              plan={plan}
              tasks={tasks}
              timeEntries={timeEntries}
              showBackButton={false}
              onBack={() => onSetActiveTab('edit')}
              onWrapUp={!isReviewed && wrapUpEligible ? () => onOpenWrapUp(plan) : undefined}
            />
          </div>
        )}
        {effectiveActiveTab === 'insights' && (
          <div className="planning-workspace__editor-canvas">
            <InsightsView
              tasks={tasks}
              workTypes={workTypes}
              planId={plan.id}
              planTitle={planDisplayName}
              projects={projects}
            />
          </div>
        )}
        {effectiveActiveTab === 'schedule' && showScheduleTab && (
          <div className="planning-workspace__editor-canvas">
            <ScheduleView
              plan={plan}
              onSave={onSavePlan}
              showBackButton={false}
              onBack={() => onSetActiveTab('edit')}
              readOnly={isReviewed}
              isWorkspaceMode
              onIssuePanelChange={onIssuePanelChange}
            />
          </div>
        )}
        {effectiveActiveTab === 'issues' && showScheduleTab && (
          <div className="planning-workspace__tab-content planning-workspace__tab-content--issues">
            <div className="planning-workspace__issues-pane">
              <SidebarIssuesPanel
                payload={scheduleIssuePanelPayload}
                isScheduleContext={true}
              />
            </div>
          </div>
        )}
        {effectiveActiveTab === 'review' && (
          <div className="planning-workspace__editor-canvas">
            <div className="planning-workspace__review-prompt">
              <p>This plan is ready for review and wrap-up.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onOpenWrapUp(plan)}
              >
                Start Wrap Up
              </button>
            </div>
          </div>
        )}
        {effectiveActiveTab === 'report' && isReviewed && (
          <EventReportView
            plan={plan}
            tasks={tasks}
            timeEntriesByTask={timeEntriesByTask}
            showBackButton={false}
            onBack={() => onSetActiveTab('edit')}
          />
        )}
      </div>
    </div>
  );
}

/** Reusable tab button to reduce repetition in the tab strip. */
function TabButton({
  tab,
  activeTab,
  onClick,
  children,
}: {
  tab: WorkspaceTab;
  activeTab: WorkspaceTab;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={activeTab === tab}
      className={`planning-workspace__tab${activeTab === tab ? ' planning-workspace__tab--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

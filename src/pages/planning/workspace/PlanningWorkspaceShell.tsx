/**
 * PlanningWorkspaceShell — desktop/tablet two-pane layout.
 *
 * Renders a persistent sidebar (plan list) alongside a main content pane.
 * The exit control in the top-left returns the user to the previous app tab.
 */

import { useMemo } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import type { Task, WorkType } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import type { PlanComparison } from '../../../lib/planning/plan-compare';
import type { Project, TimeEntry } from '../../../lib/types';
import { isPlanArchived, isPlanReviewReady } from '../../../lib/planning/plan-lifecycle';
import { PlanList } from '../PlanList';
import { PlanEditor } from '../PlanEditor';
import { ScheduleView } from '../ScheduleView';
import { CompareView } from '../CompareView';
import { ProgressView } from '../ProgressView';
import { InsightsView } from '../InsightsView';
import { WrapUpSheet } from '../WrapUpSheet';
import { EventReportView } from '../EventReportView';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { ChevronLeftIcon } from '../../../components/icons';
import { getFeatureFlag } from '../../../lib/flags/feature-flags';

interface PlanningWorkspaceShellProps {
  // Data
  plans: Plan[];
  tasks: Task[];
  projects: Project[];
  workTypes: WorkType[];
  kpis: WorkTypeKpi[];
  timeEntries: TimeEntry[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  canComparePlans: boolean;

  // Selection
  activePlan: Plan | null;
  activeTab: WorkspaceTab;
  comparison: PlanComparison | null;
  hasLinkedTasks: boolean;
  wrapUpPlan: Plan | null;

  // Navigation
  onSelectPlan: (plan: Plan) => void;
  onCreatePlan: () => void;
  onDeletePlan: (id: string) => void;
  onSavePlan: (plan: Plan) => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  onOpenInsights: () => void;
  onOpenCompare: (planId: string) => void;
  onOpenProgress: () => void;
  onOpenWrapUp: (plan: Plan) => void;
  onCloseWrapUp: () => void;
  onWrapUpCompleted: (plan: Plan) => void;

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
  canComparePlans,
  activePlan,
  activeTab,
  comparison,
  hasLinkedTasks,
  wrapUpPlan,
  onSelectPlan,
  onCreatePlan,
  onDeletePlan,
  onSavePlan,
  onSetActiveTab,
  onOpenInsights,
  onOpenCompare,
  onOpenProgress,
  onOpenWrapUp,
  onCloseWrapUp,
  onWrapUpCompleted,
  onExit,
}: PlanningWorkspaceShellProps) {
  const wrapUpSheet = useMemo(() => {
    if (!wrapUpPlan) return null;
    return (
      <WrapUpSheet
        isOpen
        plan={wrapUpPlan}
        tasks={tasks}
        timeEntriesByTask={timeEntriesByTask}
        onClose={onCloseWrapUp}
        onCompleted={onWrapUpCompleted}
      />
    );
  }, [wrapUpPlan, tasks, timeEntriesByTask, onCloseWrapUp, onWrapUpCompleted]);

  return (
    <div className="planning-workspace">
      {/* Sidebar */}
      <aside className="planning-workspace__sidebar">
        <div className="planning-workspace__sidebar-header">
          <button
            type="button"
            className="planning-workspace__exit"
            onClick={onExit}
            aria-label="Exit planning workspace"
          >
            <ChevronLeftIcon className="planning-workspace__exit-icon" />
            <span>Exit</span>
          </button>
        </div>
        <div className="planning-workspace__sidebar-content">
          <PlanList
            plans={plans}
            tasks={tasks}
            onSelect={onSelectPlan}
            onCreate={onCreatePlan}
            onDelete={onDeletePlan}
            onOpenWrapUp={onOpenWrapUp}
            onOpenInsights={onOpenInsights}
            selectedPlanId={activePlan?.id ?? null}
            sidebarMode
          />
        </div>
      </aside>

      {/* Main pane */}
      <section className="planning-workspace__main">
        {activePlan ? (
          <WorkspaceMainPane
            plan={activePlan}
            activeTab={activeTab}
            plans={plans}
            tasks={tasks}
            projects={projects}
            kpis={kpis}
            timeEntries={timeEntries}
            timeEntriesByTask={timeEntriesByTask}
            canComparePlans={canComparePlans}
            hasLinkedTasks={hasLinkedTasks}
            comparison={comparison}
            onSavePlan={onSavePlan}
            onSetActiveTab={onSetActiveTab}
            onOpenCompare={onOpenCompare}
            onOpenProgress={onOpenProgress}
            onOpenWrapUp={onOpenWrapUp}
          />
        ) : activeTab === 'insights' ? (
          <InsightsView tasks={tasks} workTypes={workTypes} />
        ) : (
          <div className="planning-workspace__empty">
            <p>Select a plan from the sidebar to begin editing.</p>
          </div>
        )}
      </section>

      {wrapUpSheet}
    </div>
  );
}

// --- Main pane with tab strip ---

interface WorkspaceMainPaneProps {
  plan: Plan;
  activeTab: WorkspaceTab;
  plans: Plan[];
  tasks: Task[];
  projects: Project[];
  kpis: WorkTypeKpi[];
  timeEntries: TimeEntry[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  canComparePlans: boolean;
  hasLinkedTasks: boolean;
  comparison: PlanComparison | null;
  onSavePlan: (plan: Plan) => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  onOpenCompare: (planId: string) => void;
  onOpenProgress: () => void;
  onOpenWrapUp: (plan: Plan) => void;
}

function WorkspaceMainPane({
  plan,
  activeTab,
  plans,
  tasks,
  projects,
  kpis,
  timeEntries,
  timeEntriesByTask,
  canComparePlans,
  hasLinkedTasks,
  comparison,
  onSavePlan,
  onSetActiveTab,
  onOpenCompare,
  onOpenProgress,
  onOpenWrapUp,
}: WorkspaceMainPaneProps) {
  const isReviewed = isPlanArchived(plan);
  const reviewReady = isPlanReviewReady(plan, tasks);
  const scheduleEnabled = getFeatureFlag('planningScheduleV1');
  const showScheduleTab = scheduleEnabled && !isReviewed;
  const effectiveActiveTab: WorkspaceTab =
    activeTab === 'schedule' && !showScheduleTab ? 'edit' : activeTab;

  return (
    <div className="planning-workspace__main-inner">
      {/* Context-aware tab strip */}
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        <TabButton tab="edit" activeTab={effectiveActiveTab} onSetActiveTab={onSetActiveTab}>
          {isReviewed ? 'Plan' : 'Edit'}
        </TabButton>
        {showScheduleTab && (
          <TabButton tab="schedule" activeTab={effectiveActiveTab} onSetActiveTab={onSetActiveTab}>
            Schedule
          </TabButton>
        )}
        {hasLinkedTasks && (
          <TabButton tab="progress" activeTab={effectiveActiveTab} onSetActiveTab={() => onOpenProgress()}>
            Progress
          </TabButton>
        )}
        {canComparePlans && (
          <TabButton tab="compare" activeTab={effectiveActiveTab} onSetActiveTab={onSetActiveTab}>
            Compare
          </TabButton>
        )}
        {isReviewed && (
          <TabButton tab="report" activeTab={effectiveActiveTab} onSetActiveTab={onSetActiveTab}>
            Report
          </TabButton>
        )}
      </nav>

      {/* Tab content */}
      <div className="planning-workspace__tab-content" role="tabpanel">
        {isReviewed && (
          <div className="planning-workspace__reviewed-banner">
            This plan was reviewed and archived{plan.reviewedAt ? ` on ${new Date(plan.reviewedAt).toLocaleDateString()}` : ''}.
          </div>
        )}
        {effectiveActiveTab === 'edit' && (
          <PlanEditor
            plan={plan}
            kpis={kpis}
            plans={plans}
            projects={projects}
            canComparePlans={canComparePlans}
            canOpenProgress={hasLinkedTasks}
            readOnly={isReviewed}
            onSave={onSavePlan}
            onBack={() => {}} // no-op in workspace mode
            onCompare={onOpenCompare}
            onOpenSchedule={showScheduleTab ? () => onSetActiveTab('schedule') : undefined}
            onOpenProgress={onOpenProgress}
            onOpenReport={() => onSetActiveTab('report')}
          />
        )}
        {effectiveActiveTab === 'progress' && (
          <ProgressView
            plan={plan}
            tasks={tasks}
            timeEntries={timeEntries}
            onBack={() => onSetActiveTab('edit')}
            onWrapUp={!isReviewed && reviewReady ? () => onOpenWrapUp(plan) : undefined}
          />
        )}
        {effectiveActiveTab === 'schedule' && showScheduleTab && (
          <ScheduleView
            plan={plan}
            onSave={onSavePlan}
            onBack={() => onSetActiveTab('edit')}
            readOnly={isReviewed}
          />
        )}
        {effectiveActiveTab === 'compare' && comparison && (
          <CompareView
            comparison={comparison}
            onBack={() => onSetActiveTab('edit')}
          />
        )}
        {effectiveActiveTab === 'report' && isReviewed && (
          <EventReportView
            plan={plan}
            tasks={tasks}
            timeEntriesByTask={timeEntriesByTask}
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
  onSetActiveTab,
  children,
}: {
  tab: WorkspaceTab;
  activeTab: WorkspaceTab;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={activeTab === tab}
      className={`planning-workspace__tab${activeTab === tab ? ' planning-workspace__tab--active' : ''}`}
      onClick={() => onSetActiveTab(tab)}
    >
      {children}
    </button>
  );
}

/**
 * PlanningWorkspaceShell — desktop/tablet two-pane layout.
 *
 * Renders a persistent sidebar (plan list) alongside a main content pane.
 * The exit control in the top-left returns the user to the previous app tab.
 */

import { useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import type { Task, WorkType } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import type { Project, TimeEntry } from '../../../lib/types';
import { isPlanArchived } from '../../../lib/planning/plan-lifecycle';
import { usePlanIdsWithImportedExecutionReturns } from '../hooks/usePlanIdsWithImportedExecutionReturns';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { SharedScheduleView } from '../SharedScheduleView';
import { InsightsView } from '../InsightsView';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import {
  getVisibleGlobalWorkspaceTabs,
  type WorkspaceRenderContext,
} from './workspace-tabs';
import { SparklesIcon, TaskListIcon } from '../../../components/icons';
import { WrapUpReviewPane } from '../WrapUpReviewPane';
import { ScheduleEditContext, type ScheduleEditContextValue } from './ScheduleEditContext';
import { WrapUpMainPane } from './WrapUpMainPane';
import { SharedScheduleMainPane } from './SharedScheduleMainPane';
import { WorkspaceMainPane } from './WorkspaceMainPane';

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
  const planIdsWithImportedExecutionReturns = usePlanIdsWithImportedExecutionReturns();
  const [scheduleCtx, setScheduleCtx] = useState<ScheduleEditContextValue | null>(null);
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

  const sidebarFooter = sidebarTabs.length > 0 ? (
    <>
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
    </>
  ) : null;

  return (
    <ScheduleEditContext.Provider value={scheduleCtx}>
    <div className="planning-workspace">
      {/* Sidebar */}
      <WorkspaceSidebar
        plans={plans}
        projects={projects}
        tasks={tasks}
        activePlan={activePlan}
        activeTab={activeTab}
        onSelectPlan={onSelectPlan}
        onCreatePlan={onCreatePlan}
        onDeletePlan={onDeletePlan}
        onOpenWrapUp={onOpenWrapUp}
        onExit={onExit}
        footer={sidebarFooter}
        showAddToScheduleButton={activeTab === 'shared-schedule'}
        selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
        onSelectedPlanIdsChange={onSetSelectedPlanIdsForSharedSchedule}
      />

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
            planIdsWithImportedExecutionReturns={planIdsWithImportedExecutionReturns}
            onScheduleContextChange={setScheduleCtx}
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
    </ScheduleEditContext.Provider>
  );
}

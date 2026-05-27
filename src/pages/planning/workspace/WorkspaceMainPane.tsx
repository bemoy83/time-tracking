import { useCallback, useRef } from 'react';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import { getProjectDisplayColor, type Project, type Task, type TimeEntry, type WorkType } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import { isPlanArchived, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisiblePlanWorkspaceTabs } from './workspace-tabs';
import { PlanEditor } from '../PlanEditor';
import { ScheduleView } from '../ScheduleView';
import { ProgressView } from '../ProgressView';
import { InsightsView } from '../InsightsView';
import { EventReportView } from '../EventReportView';
import type { ScheduleEditContextValue } from './ScheduleEditContext';
import { PlanContextStrip, getPlanContextPhases } from './PlanContextStrip';
import { WorkspacePaneFrame } from './WorkspacePaneFrame';

export interface WorkspaceMainPaneProps {
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
  planIdsWithImportedExecutionReturns: Set<string>;
  onScheduleContextChange: (ctx: ScheduleEditContextValue | null) => void;
}

export function WorkspaceMainPane({
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
  onScheduleContextChange,
  planIdsWithImportedExecutionReturns,
}: WorkspaceMainPaneProps) {
  const beforeScheduleTabRef = useRef<(() => Promise<void>) | null>(null);
  const selectedProject = plan.projectId
    ? projects.find((project) => project.id === plan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(plan, selectedProject);
  const projectAccentColor = selectedProject ? getProjectDisplayColor(selectedProject.color) : null;

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
  const reviewedDateText = plan.reviewedAt ? ` on ${new Date(plan.reviewedAt).toLocaleDateString()}` : '';
  const contextStrip = (
    <PlanContextStrip
      title={planDisplayName}
      status={wrapUpEligible ? 'review-ready' : plan.status === 'active' ? 'ready' : plan.status}
      projectAccentColor={projectAccentColor}
      phases={getPlanContextPhases(plan)}
    />
  );

  return (
    <WorkspacePaneFrame
      tabs={tabs}
      activeTab={effectiveActiveTab}
      contextStrip={contextStrip}
      ariaLabel={`${planDisplayName} workspace`}
    >
      {isReviewed && (
        <div className="planning-workspace__reviewed-banner">
          This plan was reviewed and archived{reviewedDateText}.
        </div>
      )}
      {effectiveActiveTab === 'edit' && (
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
      )}
      {effectiveActiveTab === 'progress' && (
        <ProgressView
          plan={plan}
          tasks={tasks}
          timeEntries={timeEntries}
          showBackButton={false}
          onBack={() => onSetActiveTab('edit')}
          onWrapUp={!isReviewed && wrapUpEligible ? () => onOpenWrapUp(plan) : undefined}
        />
      )}
      {effectiveActiveTab === 'insights' && (
        <InsightsView
          tasks={tasks}
          workTypes={workTypes}
          planId={plan.id}
          planTitle={planDisplayName}
          projects={projects}
        />
      )}
      {effectiveActiveTab === 'schedule' && showScheduleTab && (
        <ScheduleView
          plan={plan}
          onSave={onSavePlan}
          readOnly={isReviewed}
          onScheduleContextChange={onScheduleContextChange}
        />
      )}
      {effectiveActiveTab === 'review' && (
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
    </WorkspacePaneFrame>
  );
}

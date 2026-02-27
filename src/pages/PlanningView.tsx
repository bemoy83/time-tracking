import { PlanEditor } from './planning/PlanEditor';
import { ScheduleView } from './planning/ScheduleView';
import { CompareView } from './planning/CompareView';
import { ProgressView } from './planning/ProgressView';
import { PlanningListRoute } from './planning/PlanningListRoute';
import { PlanningInsightsRoute } from './planning/PlanningInsightsRoute';
import { PlanningWorkspaceShell } from './planning/workspace/PlanningWorkspaceShell';
import { EventReportView } from './planning/EventReportView';
import { PlanningWrapUpSheet } from './planning/PlanningWrapUpSheet';
import {
  usePlanningWorkspaceState,
  type NavigationMode,
} from './planning/hooks/usePlanningWorkspaceState';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from '../lib/hooks/useMediaQuery';
import { getFeatureFlag } from '../lib/flags/feature-flags';
import { isPlanArchived } from '../lib/planning/plan-lifecycle';

interface PlanningViewProps {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'schedule' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
  /** Called when the workspace exit control is clicked. */
  onExitWorkspace?: () => void;
}

export function PlanningView({
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
  onExitWorkspace,
}: PlanningViewProps = {}) {
  const isWideScreen = useMediaQuery(WORKSPACE_MIN_WIDTH);
  const workspaceEnabled = getFeatureFlag('planningWorkspaceDesktop');
  const scheduleEnabled = getFeatureFlag('planningScheduleV1');
  const mode: NavigationMode = workspaceEnabled && isWideScreen ? 'workspace' : 'stack';

  const workspace = usePlanningWorkspaceState({
    mode,
    initialPlanId,
    initialSubView,
    onInitialNavigationHandled,
  });

  // --- Workspace (desktop/tablet) rendering ---
  if (mode === 'workspace') {
    return (
      <PlanningWorkspaceShell
        plans={workspace.plans}
        tasks={workspace.tasks}
        projects={workspace.projects}
        workTypes={workspace.workTypes}
        kpis={workspace.kpis}
        timeEntries={workspace.timeEntries}
        timeEntriesByTask={workspace.timeEntriesByTask}
        canComparePlans={workspace.canComparePlans}
        activePlan={workspace.activePlan}
        activeTab={workspace.activeTab}
        comparison={workspace.comparison}
        hasLinkedTasks={workspace.hasLinkedTasks}
        wrapUpPlan={workspace.wrapUpPlan}
        onSelectPlan={workspace.handleSelectPlan}
        onCreatePlan={workspace.handleCreatePlan}
        onDeletePlan={workspace.handleDeletePlan}
        onSavePlan={workspace.handleSavePlan}
        onSetActiveTab={workspace.setActiveTab}
        onOpenInsights={workspace.openInsights}
        onOpenCompare={workspace.openCompare}
        onOpenProgress={workspace.openProgress}
        onOpenWrapUp={workspace.openWrapUp}
        onCloseWrapUp={workspace.closeWrapUp}
        onWrapUpCompleted={workspace.handleWrapUpCompleted}
        onExit={onExitWorkspace ?? (() => {})}
      />
    );
  }

  // --- Stack (mobile) rendering ---

  const wrapUpSheet = (
    <PlanningWrapUpSheet
      wrapUpPlan={workspace.wrapUpPlan}
      tasks={workspace.tasks}
      timeEntriesByTask={workspace.timeEntriesByTask}
      onClose={workspace.closeWrapUp}
      onCompleted={workspace.handleWrapUpCompleted}
    />
  );

  if (workspace.subView === 'list') {
    return (
      <>
        <PlanningListRoute
          plans={workspace.plans}
          tasks={workspace.tasks}
          onSelect={workspace.handleSelectPlan}
          onCreate={workspace.handleCreatePlan}
          onDelete={workspace.handleDeletePlan}
          onOpenWrapUp={workspace.openWrapUp}
          onOpenInsights={workspace.openInsights}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'insights') {
    return (
      <>
        <PlanningInsightsRoute
          tasks={workspace.tasks}
          workTypes={workspace.workTypes}
          onBack={workspace.handleBack}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.canComparePlans && workspace.subView === 'compare' && workspace.activePlan && workspace.comparison) {
    return (
      <>
        <CompareView
          comparison={workspace.comparison}
          onBack={() => workspace.setSubView('edit')}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'edit' && workspace.activePlan) {
    return (
      <>
        <PlanEditor
          plan={workspace.activePlan}
          kpis={workspace.kpis}
          plans={workspace.plans}
          projects={workspace.projects}
          canComparePlans={workspace.canComparePlans}
          canOpenProgress={workspace.hasLinkedTasks}
          readOnly={isPlanArchived(workspace.activePlan)}
          onSave={workspace.handleSavePlan}
          onBack={workspace.handleBack}
          onCompare={workspace.openCompare}
          onOpenSchedule={
            canShowScheduleTab(workspace.activePlan, scheduleEnabled)
              ? workspace.openSchedule
              : undefined
          }
          onOpenProgress={workspace.openProgress}
          onOpenReport={workspace.openReport}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (
    workspace.subView === 'schedule'
    && workspace.activePlan
    && canShowScheduleTab(workspace.activePlan, scheduleEnabled)
  ) {
    return (
      <>
        <ScheduleView
          plan={workspace.activePlan}
          onSave={workspace.handleSavePlan}
          onBack={() => workspace.setSubView('edit')}
          readOnly={isPlanArchived(workspace.activePlan)}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'progress' && workspace.activePlan) {
    const activePlan = workspace.activePlan;
    return (
      <>
        <ProgressView
          plan={activePlan}
          tasks={workspace.tasks}
          timeEntries={workspace.timeEntries}
          onBack={() => workspace.setSubView('edit')}
          onWrapUp={() => workspace.openWrapUp(activePlan)}
        />
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'report' && workspace.activePlan) {
    return (
      <>
        <EventReportView
          plan={workspace.activePlan}
          tasks={workspace.tasks}
          timeEntriesByTask={workspace.timeEntriesByTask}
          onBack={() => workspace.setSubView('edit')}
        />
        {wrapUpSheet}
      </>
    );
  }

  return wrapUpSheet;
}

function canShowScheduleTab(
  plan: ReturnType<typeof usePlanningWorkspaceState>['activePlan'],
  scheduleEnabled: boolean,
): boolean {
  if (!plan) return false;
  return scheduleEnabled && !isPlanArchived(plan);
}

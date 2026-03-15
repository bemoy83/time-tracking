import { Suspense } from 'react';
import { NewPlanSheet } from './planning/NewPlanSheet';
import { PlanningWrapUpSheet } from './planning/PlanningWrapUpSheet';
import { LoadingBlock } from '../components/LoadingBlock';
import {
  usePlanningWorkspaceState,
  type NavigationMode,
} from './planning/hooks/usePlanningWorkspaceState';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from '../lib/hooks/useMediaQuery';
import { getFeatureFlag } from '../lib/flags/feature-flags';
import { isPlanArchived } from '../lib/planning/plan-lifecycle';
import { lazyNamedExport } from '../lib/react/lazy-named-export';
import '../styles/features/planning.css';

const PlanEditor = lazyNamedExport(() => import('./planning/PlanEditor'), 'PlanEditor');
const ScheduleView = lazyNamedExport(() => import('./planning/ScheduleView'), 'ScheduleView');
const ProgressView = lazyNamedExport(() => import('./planning/ProgressView'), 'ProgressView');
const PlanningListRoute = lazyNamedExport(() => import('./planning/PlanningListRoute'), 'PlanningListRoute');
const PlanningInsightsRoute = lazyNamedExport(() => import('./planning/PlanningInsightsRoute'), 'PlanningInsightsRoute');
const PlanningWorkspaceShell = lazyNamedExport(() => import('./planning/workspace/PlanningWorkspaceShell'), 'PlanningWorkspaceShell');
const EventReportView = lazyNamedExport(() => import('./planning/EventReportView'), 'EventReportView');

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
  const mode: NavigationMode = workspaceEnabled && isWideScreen ? 'workspace' : 'stack';

  const workspace = usePlanningWorkspaceState({
    mode,
    initialPlanId,
    initialSubView,
    onInitialNavigationHandled,
  });

  const newPlanSheet = (
    <NewPlanSheet
      isOpen={workspace.showNewPlanSheet}
      onClose={() => workspace.setShowNewPlanSheet(false)}
      projects={workspace.projects}
      onConfirm={workspace.handleCreatePlan}
      variant={mode === 'workspace' ? 'modal' : 'sheet'}
    />
  );
  const routeFallback = <LoadingBlock message="Loading..." />;

  // --- Workspace (desktop/tablet) rendering ---
  if (mode === 'workspace') {
    return (
      <>
        <Suspense fallback={routeFallback}>
          <PlanningWorkspaceShell
            plans={workspace.plans}
            tasks={workspace.tasks}
            projects={workspace.projects}
            workTypes={workspace.workTypes}
            kpis={workspace.kpis}
            timeEntries={workspace.timeEntries}
            timeEntriesByTask={workspace.timeEntriesByTask}
            activePlan={workspace.activePlan}
            activeTab={workspace.activeTab}
            hasLinkedTasks={workspace.hasLinkedTasks}
            wrapUpPlan={workspace.wrapUpPlan}
            selectedPlanIdsForSharedSchedule={workspace.selectedPlanIdsForSharedSchedule}
            archiveExpanded={workspace.archiveExpanded}
            onToggleArchive={workspace.toggleArchiveExpanded}
            onSelectPlan={workspace.handleSelectPlan}
            onCreatePlan={workspace.handleRequestNewPlan}
            onDeletePlan={workspace.handleDeletePlan}
            onSavePlan={workspace.handleSavePlan}
            onSetActiveTab={workspace.setActiveTab}
            onSetSelectedPlanIdsForSharedSchedule={workspace.setSelectedPlanIdsForSharedSchedule}
            onOpenInsights={workspace.openInsights}
            onOpenProgress={workspace.openProgress}
            onOpenWrapUp={workspace.openWrapUp}
            onCloseWrapUp={workspace.closeWrapUp}
            onWrapUpCompleted={workspace.handleWrapUpCompleted}
            onExit={onExitWorkspace ?? (() => {})}
          />
        </Suspense>
        {newPlanSheet}
      </>
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
        <Suspense fallback={routeFallback}>
          <PlanningListRoute
            plans={workspace.plans}
            projects={workspace.projects}
            tasks={workspace.tasks}
            onSelect={workspace.handleSelectPlan}
            onCreate={workspace.handleRequestNewPlan}
            onDelete={workspace.handleDeletePlan}
            onOpenWrapUp={workspace.openWrapUp}
            onOpenInsights={workspace.openInsights}
          />
        </Suspense>
        {wrapUpSheet}
        {newPlanSheet}
      </>
    );
  }

  if (workspace.subView === 'insights') {
    return (
      <>
        <Suspense fallback={routeFallback}>
          <PlanningInsightsRoute
            tasks={workspace.tasks}
            workTypes={workspace.workTypes}
            plans={workspace.plans}
            projects={workspace.projects}
            onBack={workspace.handleBack}
          />
        </Suspense>
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'edit' && workspace.activePlan) {
    return (
      <>
        <Suspense fallback={routeFallback}>
          <PlanEditor
            plan={workspace.activePlan}
            kpis={workspace.kpis}
            projects={workspace.projects}
            canOpenProgress={workspace.hasLinkedTasks}
            readOnly={isPlanArchived(workspace.activePlan)}
            onSave={workspace.handleSavePlan}
            onBack={workspace.handleBack}
            onOpenSchedule={
              canShowScheduleTab(workspace.activePlan)
                ? workspace.openSchedule
                : undefined
            }
            onOpenProgress={workspace.openProgress}
            onOpenReport={workspace.openReport}
          />
        </Suspense>
        {wrapUpSheet}
      </>
    );
  }

  if (
    workspace.subView === 'schedule'
    && workspace.activePlan
    && canShowScheduleTab(workspace.activePlan)
  ) {
    return (
      <>
        <Suspense fallback={routeFallback}>
          <ScheduleView
            plan={workspace.activePlan}
            onSave={workspace.handleSavePlan}
            onBack={() => workspace.setSubView('edit')}
            readOnly={isPlanArchived(workspace.activePlan)}
          />
        </Suspense>
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'progress' && workspace.activePlan) {
    const activePlan = workspace.activePlan;
    return (
      <>
        <Suspense fallback={routeFallback}>
          <ProgressView
            plan={activePlan}
            tasks={workspace.tasks}
            timeEntries={workspace.timeEntries}
            onBack={() => workspace.setSubView('edit')}
            onWrapUp={() => workspace.openWrapUp(activePlan)}
          />
        </Suspense>
        {wrapUpSheet}
      </>
    );
  }

  if (workspace.subView === 'report' && workspace.activePlan) {
    return (
      <>
        <Suspense fallback={routeFallback}>
          <EventReportView
            plan={workspace.activePlan}
            tasks={workspace.tasks}
            timeEntriesByTask={workspace.timeEntriesByTask}
            onBack={() => workspace.setSubView('edit')}
          />
        </Suspense>
        {wrapUpSheet}
      </>
    );
  }

  return wrapUpSheet;
}

function canShowScheduleTab(
  plan: ReturnType<typeof usePlanningWorkspaceState>['activePlan'],
): boolean {
  if (!plan) return false;
  return !isPlanArchived(plan);
}

import { useMemo } from 'react';
import { PlanEditor } from './planning/PlanEditor';
import { CompareView } from './planning/CompareView';
import { ProgressView } from './planning/ProgressView';
import { WrapUpSheet } from './planning/WrapUpSheet';
import { PlanningListRoute } from './planning/PlanningListRoute';
import { PlanningInsightsRoute } from './planning/PlanningInsightsRoute';
import { PlanningWorkspaceShell } from './planning/workspace/PlanningWorkspaceShell';
import {
  usePlanningWorkspaceState,
  type NavigationMode,
} from './planning/hooks/usePlanningWorkspaceState';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from '../lib/hooks/useMediaQuery';
import { getFeatureFlag } from '../lib/flags/feature-flags';

interface PlanningViewProps {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'progress' | 'insights';
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
    <WrapUpSheetMemo
      wrapUpPlan={workspace.wrapUpPlan}
      tasks={workspace.tasks}
      timeEntriesByTask={workspace.timeEntriesByTask}
      closeWrapUp={workspace.closeWrapUp}
      handleWrapUpCompleted={workspace.handleWrapUpCompleted}
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
          onSave={workspace.handleSavePlan}
          onBack={workspace.handleBack}
          onCompare={workspace.openCompare}
          onOpenProgress={workspace.openProgress}
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

  return wrapUpSheet;
}

// Extracted to avoid re-creating the memo on every render path
function WrapUpSheetMemo({
  wrapUpPlan,
  tasks,
  timeEntriesByTask,
  closeWrapUp,
  handleWrapUpCompleted,
}: {
  wrapUpPlan: ReturnType<typeof usePlanningWorkspaceState>['wrapUpPlan'];
  tasks: ReturnType<typeof usePlanningWorkspaceState>['tasks'];
  timeEntriesByTask: ReturnType<typeof usePlanningWorkspaceState>['timeEntriesByTask'];
  closeWrapUp: ReturnType<typeof usePlanningWorkspaceState>['closeWrapUp'];
  handleWrapUpCompleted: ReturnType<typeof usePlanningWorkspaceState>['handleWrapUpCompleted'];
}) {
  return useMemo(() => {
    if (!wrapUpPlan) return null;
    return (
      <WrapUpSheet
        isOpen
        plan={wrapUpPlan}
        tasks={tasks}
        timeEntriesByTask={timeEntriesByTask}
        onClose={closeWrapUp}
        onCompleted={handleWrapUpCompleted}
      />
    );
  }, [wrapUpPlan, tasks, timeEntriesByTask, closeWrapUp, handleWrapUpCompleted]);
}

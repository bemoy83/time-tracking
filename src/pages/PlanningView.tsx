import { useMemo } from 'react';
import { PlanEditor } from './planning/PlanEditor';
import { CompareView } from './planning/CompareView';
import { ProgressView } from './planning/ProgressView';
import { WrapUpSheet } from './planning/WrapUpSheet';
import { PlanningListRoute } from './planning/PlanningListRoute';
import { PlanningInsightsRoute } from './planning/PlanningInsightsRoute';
import { usePlanningWorkspaceState } from './planning/hooks/usePlanningWorkspaceState';

interface PlanningViewProps {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
}

export function PlanningView({
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
}: PlanningViewProps = {}) {
  const workspace = usePlanningWorkspaceState({
    initialPlanId,
    initialSubView,
    onInitialNavigationHandled,
  });

  const wrapUpSheet = useMemo(() => {
    if (!workspace.wrapUpPlan) return null;
    return (
      <WrapUpSheet
        isOpen
        plan={workspace.wrapUpPlan}
        tasks={workspace.tasks}
        timeEntriesByTask={workspace.timeEntriesByTask}
        onClose={workspace.closeWrapUp}
        onCompleted={workspace.handleWrapUpCompleted}
      />
    );
  }, [
    workspace.closeWrapUp,
    workspace.handleWrapUpCompleted,
    workspace.tasks,
    workspace.timeEntriesByTask,
    workspace.wrapUpPlan,
  ]);

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

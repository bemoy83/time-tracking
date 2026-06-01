import { Suspense } from 'react';
import { NewPlanSheet } from './planning/NewPlanSheet';
import { PlanningWrapUpSheet } from './planning/PlanningWrapUpSheet';
import { LoadingBlock } from '../components/LoadingBlock';
import { usePlanningWorkspaceState } from './planning/hooks/usePlanningWorkspaceState';
import { lazyNamedExport } from '../lib/react/lazy-named-export';
import '../styles/features/planning.css';

const PlanningWorkspaceShell = lazyNamedExport(() => import('./planning/workspace/PlanningWorkspaceShell'), 'PlanningWorkspaceShell');

interface PlanningViewProps {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'schedule' | 'progress' | 'insights';
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

  const newPlanSheet = (
    <NewPlanSheet
      isOpen={workspace.showNewPlanSheet}
      onClose={() => workspace.setShowNewPlanSheet(false)}
      projects={workspace.projects}
      onConfirm={workspace.handleCreatePlan}
      variant="modal"
    />
  );

  const wrapUpSheet = (
    <PlanningWrapUpSheet
      wrapUpPlan={workspace.wrapUpPlan}
      tasks={workspace.tasks}
      timeEntriesByTask={workspace.timeEntriesByTask}
      onClose={workspace.closeWrapUp}
      onCompleted={workspace.handleWrapUpCompleted}
    />
  );

  return (
    <>
      <Suspense fallback={<LoadingBlock message="Loading..." />}>
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
        />
      </Suspense>
      {wrapUpSheet}
      {newPlanSheet}
    </>
  );
}

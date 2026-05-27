import { useCallback } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import type { Task } from '../../../lib/types';
import { isPlanArchived, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisiblePlanWorkspaceTabs } from './workspace-tabs';
import { WorkspacePaneFrame } from './WorkspacePaneFrame';

export interface WrapUpMainPaneProps {
  plan: Plan;
  tasks: Task[];
  hasLinkedTasks: boolean;
  planIdsWithImportedExecutionReturns: Set<string>;
  onCloseWrapUp: () => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  children: React.ReactNode;
}

export function WrapUpMainPane({
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
    <WorkspacePaneFrame
      tabs={tabs}
      activeTab="review"
      canvasMode="fill"
      ariaLabel="Wrap up workspace"
    >
      {children}
    </WorkspacePaneFrame>
  );
}

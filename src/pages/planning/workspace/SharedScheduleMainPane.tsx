import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisibleGlobalWorkspaceTabs, type WorkspaceRenderContext } from './workspace-tabs';
import { WorkspacePaneFrame } from './WorkspacePaneFrame';
import { SharedScheduleContextStrip } from './SharedScheduleContextStrip';

export interface SharedScheduleMainPaneProps {
  activeTab: WorkspaceTab;
  sidebarTabContext: WorkspaceRenderContext;
  selectedPlanCount: number;
  children: React.ReactNode;
}

export function SharedScheduleMainPane({
  activeTab,
  sidebarTabContext,
  selectedPlanCount,
  children,
}: SharedScheduleMainPaneProps) {
  const tabs = getVisibleGlobalWorkspaceTabs(sidebarTabContext);

  return (
    <WorkspacePaneFrame
      tabs={tabs}
      activeTab={activeTab}
      contextStrip={<SharedScheduleContextStrip selectedPlanCount={selectedPlanCount} />}
      canvasMode="full-bleed"
      ariaLabel="Shared schedule workspace"
    >
      {children}
    </WorkspacePaneFrame>
  );
}

import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisibleGlobalWorkspaceTabs, type WorkspaceRenderContext } from './workspace-tabs';
import { WorkspacePaneFrame } from './WorkspacePaneFrame';

export interface SharedScheduleMainPaneProps {
  activeTab: WorkspaceTab;
  sidebarTabContext: WorkspaceRenderContext;
  children: React.ReactNode;
}

export function SharedScheduleMainPane({
  activeTab,
  sidebarTabContext,
  children,
}: SharedScheduleMainPaneProps) {
  const tabs = getVisibleGlobalWorkspaceTabs(sidebarTabContext);

  return (
    <WorkspacePaneFrame
      tabs={tabs}
      activeTab={activeTab}
      canvasMode="full-bleed"
      ariaLabel="Shared schedule workspace"
    >
      {children}
    </WorkspacePaneFrame>
  );
}

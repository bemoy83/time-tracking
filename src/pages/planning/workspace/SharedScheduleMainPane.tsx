import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisibleGlobalWorkspaceTabs, type WorkspaceRenderContext } from './workspace-tabs';
import { WorkspaceTabButton } from './WorkspaceTabButton';

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
    <div className="planning-workspace__main-inner">
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        {tabs.map((tab) => (
          <WorkspaceTabButton
            key={tab.id}
            tab={tab.id}
            activeTab={activeTab}
            onClick={tab.onSelect}
          >
            {tab.label}
          </WorkspaceTabButton>
        ))}
      </nav>
      <div className="planning-workspace__tab-content" role="tabpanel">
        <div className="planning-workspace__editor-canvas">
          {children}
        </div>
      </div>
    </div>
  );
}

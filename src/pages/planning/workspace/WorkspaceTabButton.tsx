import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';

export function WorkspaceTabButton({
  tab,
  activeTab,
  onClick,
  id,
  panelId,
  children,
}: {
  tab: WorkspaceTab;
  activeTab: WorkspaceTab;
  onClick: () => void;
  id: string;
  panelId: string;
  children: React.ReactNode;
}) {
  const isActive = activeTab === tab;

  return (
    <button
      id={id}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      className={`planning-workspace__tab${isActive ? ' planning-workspace__tab--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

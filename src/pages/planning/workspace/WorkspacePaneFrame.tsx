import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import type { ResolvedWorkspaceTabDescriptor } from './workspace-tabs';
import { WorkspaceTabButton } from './WorkspaceTabButton';

const getWorkspaceTabId = (tab: WorkspaceTab) => `planning-workspace-tab-${tab}`;
const getWorkspacePanelId = (tab: WorkspaceTab) => `planning-workspace-panel-${tab}`;

interface WorkspaceTabStripProps {
  tabs: ResolvedWorkspaceTabDescriptor[];
  activeTab: WorkspaceTab;
  ariaLabel?: string;
}

export function WorkspaceTabStrip({
  tabs,
  activeTab,
  ariaLabel = 'Plan views',
}: WorkspaceTabStripProps) {
  if (tabs.length === 0) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex == null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.onSelect();
    const requestFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    requestFrame(() => {
      document.getElementById(getWorkspaceTabId(nextTab.id))?.focus();
    });
  };

  return (
    <nav
      className="planning-workspace__tabs"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <WorkspaceTabButton
          key={tab.id}
          tab={tab.id}
          activeTab={activeTab}
          onClick={tab.onSelect}
          id={getWorkspaceTabId(tab.id)}
          panelId={getWorkspacePanelId(tab.id)}
        >
          {tab.label}
        </WorkspaceTabButton>
      ))}
    </nav>
  );
}

export interface WorkspacePaneFrameProps {
  tabs?: ResolvedWorkspaceTabDescriptor[];
  activeTab?: WorkspaceTab;
  contextStrip?: React.ReactNode;
  children: React.ReactNode;
  canvasMode?: 'constrained' | 'full-bleed' | 'fill';
  ariaLabel?: string;
}

export function WorkspacePaneFrame({
  tabs = [],
  activeTab,
  contextStrip,
  children,
  canvasMode = 'constrained',
  ariaLabel,
}: WorkspacePaneFrameProps) {
  const canvasClass = [
    'planning-workspace__editor-canvas',
    canvasMode !== 'constrained' ? `planning-workspace__editor-canvas--${canvasMode}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const panelId = activeTab ? getWorkspacePanelId(activeTab) : undefined;
  const labelledBy = activeTab ? getWorkspaceTabId(activeTab) : undefined;

  return (
    <div className="planning-workspace__main-inner">
      {(contextStrip || tabs.length > 0) && (
        <div className="planning-workspace__plan-header">
          {contextStrip}
          {activeTab && <WorkspaceTabStrip tabs={tabs} activeTab={activeTab} />}
        </div>
      )}
      <div
        id={panelId}
        className="planning-workspace__tab-content"
        role="tabpanel"
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
      >
        <div className={canvasClass}>
          {children}
        </div>
      </div>
    </div>
  );
}

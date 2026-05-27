import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import type { ResolvedWorkspaceTabDescriptor } from './workspace-tabs';
import { WorkspaceTabButton } from './WorkspaceTabButton';

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

  return (
    <nav className="planning-workspace__tabs" role="tablist" aria-label={ariaLabel}>
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

  return (
    <div className="planning-workspace__main-inner">
      {contextStrip}
      {activeTab && (
        <WorkspaceTabStrip tabs={tabs} activeTab={activeTab} />
      )}
      <div className="planning-workspace__tab-content" role="tabpanel" aria-label={ariaLabel}>
        <div className={canvasClass}>
          {children}
        </div>
      </div>
    </div>
  );
}

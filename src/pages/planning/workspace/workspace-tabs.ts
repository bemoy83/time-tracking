import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';

export interface WorkspaceRenderContext {
  hasLinkedTasks: boolean;
  isReviewed: boolean;
  reviewReady: boolean;
  showScheduleTab: boolean;
  onOpenProgress: () => void;
  onOpenInsights: () => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
}

export interface WorkspaceTabDescriptor {
  id: WorkspaceTab;
  scope: 'global' | 'plan';
  label: string | ((context: WorkspaceRenderContext) => string);
  isVisible: (context: WorkspaceRenderContext) => boolean;
  onSelect: (context: WorkspaceRenderContext) => void;
}

export interface ResolvedWorkspaceTabDescriptor {
  id: WorkspaceTab;
  label: string;
  onSelect: () => void;
}

const GLOBAL_TAB_DESCRIPTORS: WorkspaceTabDescriptor[] = [
  {
    id: 'shared-schedule',
    scope: 'global',
    label: 'Shared Schedule',
    isVisible: () => true,
    onSelect: (context) => context.onSetActiveTab('shared-schedule'),
  },
  {
    id: 'insights',
    scope: 'global',
    label: 'Insights',
    isVisible: () => true,
    onSelect: (context) => context.onOpenInsights(),
  },
];

const PLAN_TAB_DESCRIPTORS: WorkspaceTabDescriptor[] = [
  {
    id: 'edit',
    scope: 'plan',
    label: (context) => (context.isReviewed ? 'Plan' : 'Edit'),
    isVisible: () => true,
    onSelect: (context) => context.onSetActiveTab('edit'),
  },
  {
    id: 'schedule',
    scope: 'plan',
    label: 'Schedule',
    isVisible: (context) => context.showScheduleTab,
    onSelect: (context) => context.onSetActiveTab('schedule'),
  },
  {
    id: 'issues',
    scope: 'plan',
    label: 'Issues',
    isVisible: (context) => context.showScheduleTab,
    onSelect: (context) => context.onSetActiveTab('issues'),
  },
  {
    id: 'shared-schedule',
    scope: 'plan',
    label: 'Shared Schedule',
    isVisible: () => false, /* Hidden from plan nav — use sidebar footer for Shared Schedule */
    onSelect: (context) => context.onSetActiveTab('shared-schedule'),
  },
  {
    id: 'progress',
    scope: 'plan',
    label: 'Progress',
    isVisible: () => true,
    onSelect: (context) => context.onOpenProgress(),
  },
  {
    id: 'insights',
    scope: 'plan',
    label: 'Insights',
    isVisible: (context) => context.hasLinkedTasks,
    onSelect: (context) => context.onSetActiveTab('insights'),
  },
  {
    id: 'review',
    scope: 'plan',
    label: 'Review',
    isVisible: (context) => context.hasLinkedTasks && context.reviewReady && !context.isReviewed,
    onSelect: (context) => context.onSetActiveTab('review'),
  },
  {
    id: 'report',
    scope: 'plan',
    label: 'Report',
    isVisible: (context) => context.isReviewed,
    onSelect: (context) => context.onSetActiveTab('report'),
  },
];

function resolveTabs(
  tabs: WorkspaceTabDescriptor[],
  context: WorkspaceRenderContext,
): ResolvedWorkspaceTabDescriptor[] {
  return tabs
    .filter((tab) => tab.isVisible(context))
    .map((tab) => ({
      id: tab.id,
      label: typeof tab.label === 'function' ? tab.label(context) : tab.label,
      onSelect: () => tab.onSelect(context),
    }));
}

export function getVisibleGlobalWorkspaceTabs(
  context: WorkspaceRenderContext,
): ResolvedWorkspaceTabDescriptor[] {
  return resolveTabs(GLOBAL_TAB_DESCRIPTORS, context);
}

export function getVisiblePlanWorkspaceTabs(
  context: WorkspaceRenderContext,
): ResolvedWorkspaceTabDescriptor[] {
  return resolveTabs(PLAN_TAB_DESCRIPTORS, context);
}

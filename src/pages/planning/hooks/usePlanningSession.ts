import type { WorkspaceTab } from './usePlanningWorkspaceState';
import type { SidebarPane } from '../workspace/schedule-issue-panel-types';

const STORAGE_KEY = 'planning-workspace-session';

interface PlanningSession {
  selectedPlanId: string | null;
  activeTab: WorkspaceTab;
  selectedPlanIdsForSharedSchedule: string[];
  sidebarPane: SidebarPane;
}

const DEFAULT_SESSION: PlanningSession = {
  selectedPlanId: null,
  activeTab: 'edit',
  selectedPlanIdsForSharedSchedule: [],
  sidebarPane: 'metrics',
};

function isWorkspaceTab(value: unknown): value is WorkspaceTab {
  return value === 'edit'
    || value === 'schedule'
    || value === 'shared-schedule'
    || value === 'progress'
    || value === 'review'
    || value === 'insights'
    || value === 'report';
}

function isSidebarPane(value: unknown): value is SidebarPane {
  return value === 'metrics' || value === 'issues';
}

export function loadPlanningSession(): PlanningSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION;
    const parsed = JSON.parse(raw) as Partial<PlanningSession>;
    return {
      selectedPlanId: parsed.selectedPlanId ?? null,
      activeTab: isWorkspaceTab(parsed.activeTab) ? parsed.activeTab : 'edit',
      selectedPlanIdsForSharedSchedule: Array.isArray(parsed.selectedPlanIdsForSharedSchedule)
        ? parsed.selectedPlanIdsForSharedSchedule.filter((id): id is string => typeof id === 'string')
        : [],
      sidebarPane: isSidebarPane(parsed.sidebarPane) ? parsed.sidebarPane : 'metrics',
    };
  } catch {
    return DEFAULT_SESSION;
  }
}

export function savePlanningSession(session: Partial<PlanningSession>): void {
  try {
    const current = loadPlanningSession();
    const merged = { ...current, ...session };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Silently ignore storage errors
  }
}

export function clearPlanningSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore storage errors
  }
}

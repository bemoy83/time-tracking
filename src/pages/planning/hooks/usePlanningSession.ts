import type { WorkspaceTab } from './usePlanningWorkspaceState';

const STORAGE_KEY = 'planning-workspace-session';

interface PlanningSession {
  selectedPlanId: string | null;
  activeTab: WorkspaceTab;
}

const DEFAULT_SESSION: PlanningSession = {
  selectedPlanId: null,
  activeTab: 'edit',
};

export function loadPlanningSession(): PlanningSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION;
    const parsed = JSON.parse(raw) as Partial<PlanningSession>;
    return {
      selectedPlanId: parsed.selectedPlanId ?? null,
      activeTab: parsed.activeTab ?? 'edit',
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { usePlanningData, type PlanningData } from './usePlanningData';
import { loadPlanningSession, savePlanningSession } from './usePlanningSession';

/**
 * Navigation mode determines layout and navigation behavior.
 * - 'stack': mobile — full-screen sub-views pushed onto a stack
 * - 'workspace': desktop/tablet — persistent sidebar + main pane
 */
export type NavigationMode = 'stack' | 'workspace';

/** Sub-views for stack (mobile) navigation. */
export type PlanningSubView = 'list' | 'edit' | 'schedule' | 'progress' | 'insights' | 'report';

/** Tabs available in the workspace main pane. */
export type WorkspaceTab = 'edit' | 'schedule' | 'shared-schedule' | 'progress' | 'review' | 'insights' | 'report';

interface PlanningWorkspaceOptions {
  /** Navigation mode: 'stack' for mobile, 'workspace' for desktop. */
  mode?: NavigationMode;
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'schedule' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
}

function toWorkspaceTab(
  subView: PlanningWorkspaceOptions['initialSubView'],
): WorkspaceTab {
  if (subView === 'insights') return 'insights';
  if (subView === 'progress') return 'progress';
  if (subView === 'schedule') return 'schedule';
  return 'edit';
}

export function usePlanningWorkspaceState({
  mode = 'stack',
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
}: PlanningWorkspaceOptions = {}) {
  const data: PlanningData = usePlanningData();

  // --- Session restoration (workspace mode only) ---
  const session = useRef(mode === 'workspace' ? loadPlanningSession() : null).current;

  // --- Shared selection state ---
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [selectedPlanIdsForSharedScheduleState, setSelectedPlanIdsForSharedScheduleState] = useState<Set<string>>(
    () => new Set(session?.selectedPlanIdsForSharedSchedule ?? []),
  );

  // --- Sidebar preferences (workspace mode) ---
  const [archiveExpanded, setArchiveExpanded] = useState(() => {
    try { return sessionStorage.getItem('planning_archive_expanded') === 'true'; } catch { return false; }
  });

  // --- Stack navigation state (mobile) ---
  const [subView, setSubView] = useState<PlanningSubView>('list');

  // --- Workspace navigation state (desktop) ---
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    session?.activeTab ?? 'edit',
  );

  const initialNavigationAppliedRef = useRef(false);
  const sessionRestoredRef = useRef(false);

  // --- Restore session (workspace mode): re-select last plan once plans load ---
  useEffect(() => {
    if (mode !== 'workspace') return;
    if (sessionRestoredRef.current) return;
    if (data.plans.length === 0) return;
    // Don't restore if an external initial navigation was requested
    if (initialPlanId) return;

    sessionRestoredRef.current = true;
    if (!session?.selectedPlanId) return;

    const restoredPlan = data.plans.find((p) => p.id === session.selectedPlanId);
    if (restoredPlan) {
      setActivePlan(restoredPlan);
    }
  }, [mode, data.plans, session, initialPlanId]);

  // --- Persist session on selection/tab changes (workspace mode) ---
  useEffect(() => {
    if (mode !== 'workspace') return;
    savePlanningSession({
      selectedPlanId: activePlan?.id ?? null,
      activeTab,
      selectedPlanIdsForSharedSchedule: Array.from(selectedPlanIdsForSharedScheduleState),
    });
  }, [mode, activePlan, activeTab, selectedPlanIdsForSharedScheduleState]);

  // Remove shared-schedule selection entries that no longer exist.
  useEffect(() => {
    if (mode !== 'workspace') return;
    const knownPlanIds = new Set(data.plans.map((plan) => plan.id));
    setSelectedPlanIdsForSharedScheduleState((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const planId of prev) {
        if (knownPlanIds.has(planId)) next.add(planId);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [data.plans, mode]);

  // --- Sync activePlan with plans list (handle updates/deletes) ---
  useEffect(() => {
    if (!activePlan) return;
    const updated = data.plans.find((p) => p.id === activePlan.id);
    if (!updated) {
      setActivePlan(null);
      if (mode === 'stack') setSubView('list');
    }
  }, [activePlan, data.plans, mode]);

  // --- Handle initial navigation from external launch ---
  useEffect(() => {
    if (initialNavigationAppliedRef.current) return;
    if (!initialPlanId) return;
    if (data.plans.length === 0) return;

    const requestedPlan = data.plans.find((plan) => plan.id === initialPlanId);
    initialNavigationAppliedRef.current = true;
    onInitialNavigationHandled?.();

    if (!requestedPlan) return;
    setActivePlan(requestedPlan);

    if (mode === 'stack') {
      setSubView(initialSubView ?? 'edit');
    } else {
      setActiveTab(toWorkspaceTab(initialSubView));
    }
  }, [initialPlanId, initialSubView, onInitialNavigationHandled, data.plans, mode]);

  // --- Derived ---
  const hasLinkedTasks = useMemo(() => {
    if (!activePlan) return false;
    return data.hasLinkedTasksForPlan(activePlan.id);
  }, [activePlan, data]);

  // --- Navigation actions ---

  const handleSelectPlan = useCallback((plan: Plan) => {
    setActivePlan(plan);
    if (mode === 'stack') {
      setSubView('edit');
    } else {
      setActiveTab('edit');
    }
  }, [mode]);

  const handleCreatePlan = useCallback(async () => {
    const plan = await data.handleCreatePlan();
    setActivePlan(plan);
    if (mode === 'stack') {
      setSubView('edit');
    } else {
      setActiveTab('edit');
    }
  }, [data, mode]);

  const handleDeletePlan = useCallback(async (planId: string) => {
    await data.handleDeletePlan(planId);
    if (activePlan?.id === planId) {
      setActivePlan(null);
      if (mode === 'stack') setSubView('list');
    }
  }, [activePlan, data, mode]);

  const handleSavePlan = useCallback(async (plan: Plan) => {
    await data.handleSavePlan(plan);
    setActivePlan(plan);
  }, [data]);

  const handleBack = useCallback(() => {
    if (mode === 'stack') {
      setSubView('list');
      setActivePlan(null);
    }
    // Workspace mode: back is a no-op (sidebar is always visible)
  }, [mode]);

  const openInsights = useCallback(() => {
    if (mode === 'stack') {
      setSubView('insights');
    } else {
      setActivePlan(null);
      setActiveTab('insights');
    }
  }, [mode]);

  const openProgress = useCallback(async () => {
    await data.reloadTimeEntries();
    if (mode === 'stack') {
      setSubView('progress');
    } else {
      setActiveTab('progress');
    }
  }, [data, mode]);

  const openSchedule = useCallback(() => {
    if (mode === 'stack') {
      setSubView('schedule');
    } else {
      setActiveTab('schedule');
    }
  }, [mode]);

  const openReport = useCallback(() => {
    if (mode === 'stack') {
      setSubView('report');
    } else {
      setActiveTab('report');
    }
  }, [mode]);

  const toggleArchiveExpanded = useCallback(() => {
    setArchiveExpanded((prev) => {
      const next = !prev;
      try { sessionStorage.setItem('planning_archive_expanded', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleWrapUpCompleted = useCallback(async (updatedPlan: Plan, success: boolean) => {
    await data.handleWrapUpCompleted(updatedPlan, success);
    setActivePlan((prev) => (prev?.id === updatedPlan.id ? updatedPlan : prev));
  }, [data]);

  const setSelectedPlanIdsForSharedSchedule = useCallback((next: Set<string>) => {
    setSelectedPlanIdsForSharedScheduleState(new Set(next));
  }, []);

  return {
    // Navigation mode
    mode,

    // Data (pass-through from usePlanningData)
    plans: data.plans,
    timeEntries: data.timeEntries,
    timeEntriesByTask: data.timeEntriesByTask,
    kpis: data.kpis,
    tasks: data.tasks,
    projects: data.projects,
    workTypes: data.workTypes,
    wrapUpPlan: data.wrapUpPlan,

    // Selection state
    activePlan,
    hasLinkedTasks,
    selectedPlanIdsForSharedSchedule: selectedPlanIdsForSharedScheduleState,
    setSelectedPlanIdsForSharedSchedule,

    // Stack navigation (mobile)
    subView,
    setSubView,

    // Workspace navigation (desktop)
    activeTab,
    setActiveTab,

    // Sidebar preferences
    archiveExpanded,
    toggleArchiveExpanded,

    // Actions
    handleCreatePlan,
    handleSelectPlan,
    handleSavePlan,
    handleDeletePlan,
    handleBack,
    openInsights,
    openProgress,
    openSchedule,
    openReport,
    openWrapUp: data.openWrapUp,
    reloadTimeEntries: data.reloadTimeEntries,
    closeWrapUp: data.closeWrapUp,
    handleWrapUpCompleted,
  };
}

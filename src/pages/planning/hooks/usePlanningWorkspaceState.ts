import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';
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
export type PlanningSubView = 'list' | 'edit' | 'compare' | 'progress' | 'insights';

/** Tabs available in the workspace main pane. */
export type WorkspaceTab = 'edit' | 'progress' | 'compare' | 'insights';

interface PlanningWorkspaceOptions {
  /** Navigation mode: 'stack' for mobile, 'workspace' for desktop. */
  mode?: NavigationMode;
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
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
  const [comparePlanId, setComparePlanId] = useState<string | null>(null);

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
    });
  }, [mode, activePlan, activeTab]);

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
      setActiveTab(initialSubView === 'insights' ? 'insights' : initialSubView === 'progress' ? 'progress' : 'edit');
    }
  }, [initialPlanId, initialSubView, onInitialNavigationHandled, data.plans, mode]);

  // --- Guard: compare view disabled mid-session ---
  useEffect(() => {
    if (!data.canComparePlans) {
      if (mode === 'stack' && subView === 'compare') {
        setSubView('edit');
      }
      if (mode === 'workspace' && activeTab === 'compare') {
        setActiveTab('edit');
      }
      setComparePlanId(null);
    }
  }, [data.canComparePlans, subView, activeTab, mode]);

  // --- Derived ---
  const comparison = useMemo(() => {
    if (!activePlan || !comparePlanId) return null;
    return data.getComparison(activePlan, comparePlanId);
  }, [activePlan, comparePlanId, data]);

  const hasLinkedTasks = useMemo(() => {
    if (!activePlan) return false;
    return data.hasLinkedTasksForPlan(activePlan.id);
  }, [activePlan, data]);

  // --- Navigation actions ---

  const handleSelectPlan = useCallback((plan: Plan) => {
    setActivePlan(plan);
    setComparePlanId(null);
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
      setComparePlanId(null);
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
      setComparePlanId(null);
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

  const openCompare = useCallback((planId: string) => {
    trackTelemetryEvent('planning_compare_open');
    setComparePlanId(planId);
    if (mode === 'stack') {
      setSubView('compare');
    } else {
      setActiveTab('compare');
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

  const handleWrapUpCompleted = useCallback(async (updatedPlan: Plan) => {
    await data.handleWrapUpCompleted(updatedPlan);
    setActivePlan((prev) => (prev?.id === updatedPlan.id ? updatedPlan : prev));
  }, [data]);

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
    canComparePlans: data.canComparePlans,
    wrapUpPlan: data.wrapUpPlan,

    // Selection state
    activePlan,
    comparePlanId,
    comparison,
    hasLinkedTasks,

    // Stack navigation (mobile)
    subView,
    setSubView,

    // Workspace navigation (desktop)
    activeTab,
    setActiveTab,

    // Actions
    handleCreatePlan,
    handleSelectPlan,
    handleSavePlan,
    handleDeletePlan,
    handleBack,
    openInsights,
    openCompare,
    openProgress,
    openWrapUp: data.openWrapUp,
    reloadTimeEntries: data.reloadTimeEntries,
    closeWrapUp: data.closeWrapUp,
    handleWrapUpCompleted,
  };
}

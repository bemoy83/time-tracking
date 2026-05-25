import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { usePlanningData, type PlanningData } from './usePlanningData';
import { loadPlanningSession, savePlanningSession } from './usePlanningSession';

/** Tabs available in the workspace main pane. */
export type WorkspaceTab = 'edit' | 'schedule' | 'issues' | 'shared-schedule' | 'progress' | 'review' | 'insights' | 'report';

interface PlanningWorkspaceOptions {
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
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
}: PlanningWorkspaceOptions = {}) {
  const data: PlanningData = usePlanningData();

  const session = useRef(loadPlanningSession()).current;

  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [showNewPlanSheet, setShowNewPlanSheet] = useState(false);
  const [selectedPlanIdsForSharedScheduleState, setSelectedPlanIdsForSharedScheduleState] = useState<Set<string>>(
    () => new Set(session?.selectedPlanIdsForSharedSchedule ?? []),
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    session?.activeTab ?? 'edit',
  );
  const initialNavigationAppliedRef = useRef(false);
  const sessionRestoredRef = useRef(false);

  // Restore session: re-select last plan once plans load
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    if (data.plans.length === 0) return;
    if (initialPlanId) return;

    sessionRestoredRef.current = true;
    if (!session?.selectedPlanId) return;

    const restoredPlan = data.plans.find((p) => p.id === session.selectedPlanId);
    if (restoredPlan) {
      setActivePlan(restoredPlan);
    }
  }, [data.plans, session, initialPlanId]);

  // Persist session on selection/tab changes
  useEffect(() => {
    savePlanningSession({
      selectedPlanId: activePlan?.id ?? null,
      activeTab,
      selectedPlanIdsForSharedSchedule: Array.from(selectedPlanIdsForSharedScheduleState),
    });
  }, [activePlan, activeTab, selectedPlanIdsForSharedScheduleState]);

  useEffect(() => {
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
  }, [data.plans]);

  useEffect(() => {
    if (!activePlan) return;
    const updated = data.plans.find((p) => p.id === activePlan.id);
    if (!updated) {
      setActivePlan(null);
      return;
    }
    if (updated.updatedAt !== activePlan.updatedAt) {
      setActivePlan(updated);
    }
  }, [activePlan, data.plans]);

  useEffect(() => {
    if (initialNavigationAppliedRef.current) return;
    if (!initialPlanId) return;
    if (data.plans.length === 0) return;

    const requestedPlan = data.plans.find((plan) => plan.id === initialPlanId);
    initialNavigationAppliedRef.current = true;
    onInitialNavigationHandled?.();

    if (!requestedPlan) return;
    setActivePlan(requestedPlan);
    setActiveTab(toWorkspaceTab(initialSubView));
  }, [initialPlanId, initialSubView, onInitialNavigationHandled, data.plans]);

  const hasLinkedTasks = useMemo(() => {
    if (!activePlan) return false;
    return data.hasLinkedTasksForPlan(activePlan.id);
  }, [activePlan, data]);

  const handleSelectPlan = useCallback((plan: Plan) => {
    setActivePlan(plan);
    setActiveTab('edit');
  }, []);

  const handleRequestNewPlan = useCallback(() => {
    setShowNewPlanSheet(true);
  }, []);

  const handleCreatePlan = useCallback(async (init?: {
    title?: string;
    projectId?: string | null;
  }) => {
    const plan = await data.handleCreatePlan(init);
    setShowNewPlanSheet(false);
    setActivePlan(plan);
    setActiveTab('edit');
  }, [data]);

  const handleDeletePlan = useCallback(async (planId: string) => {
    await data.handleDeletePlan(planId);
    if (activePlan?.id === planId) {
      setActivePlan(null);
    }
  }, [activePlan, data]);

  const handleSavePlan = useCallback(async (plan: Plan) => {
    await data.handleSavePlan(plan);
    setActivePlan(plan);
  }, [data]);

  const openInsights = useCallback(() => {
    setActivePlan(null);
    setActiveTab('insights');
  }, []);

  const openProgress = useCallback(async () => {
    await data.reloadTimeEntries();
    setActiveTab('progress');
  }, [data]);

  const openSchedule = useCallback(() => {
    setActiveTab('schedule');
  }, []);

  const openReport = useCallback(() => {
    setActiveTab('report');
  }, []);

  const handleWrapUpCompleted = useCallback(async (updatedPlan: Plan, success: boolean) => {
    await data.handleWrapUpCompleted(updatedPlan, success);
    setActivePlan((prev) => (prev?.id === updatedPlan.id ? updatedPlan : prev));
  }, [data]);

  const setSelectedPlanIdsForSharedSchedule = useCallback((next: Set<string>) => {
    setSelectedPlanIdsForSharedScheduleState(new Set(next));
  }, []);

  return {
    plans: data.plans,
    timeEntries: data.timeEntries,
    timeEntriesByTask: data.timeEntriesByTask,
    kpis: data.kpis,
    tasks: data.tasks,
    projects: data.projects,
    workTypes: data.workTypes,
    wrapUpPlan: data.wrapUpPlan,

    activePlan,
    hasLinkedTasks,
    selectedPlanIdsForSharedSchedule: selectedPlanIdsForSharedScheduleState,
    setSelectedPlanIdsForSharedSchedule,

    activeTab,
    setActiveTab,

    showNewPlanSheet,
    setShowNewPlanSheet,
    handleRequestNewPlan,

    handleCreatePlan,
    handleSelectPlan,
    handleSavePlan,
    handleDeletePlan,
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

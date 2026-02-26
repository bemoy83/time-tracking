import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkTypeStore } from '../../../lib/stores/work-type-store';
import {
  addPlan,
  deletePlan,
  getAllPlans,
  getAllTimeEntries,
  updatePlan,
} from '../../../lib/db';
import { comparePlans } from '../../../lib/planning/plan-compare';
import { createPlan, type Plan } from '../../../lib/planning/plan-model';
import { computeWorkTypeKpis, type WorkTypeKpi } from '../../../lib/kpi';
import { buildAttributedRollup } from '../../../lib/attributed-rollup';
import { getOutlierHandlingMode } from '../../../lib/stores/kpi-settings';
import { getFeatureFlag } from '../../../lib/flags/feature-flags';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';
import { refreshTasks, useTaskStore } from '../../../lib/stores/task-store';
import { buildTimeEntriesByTask } from '../../../lib/time-entries-index';

export type PlanningSubView = 'list' | 'edit' | 'compare' | 'progress' | 'insights';

interface PlanningWorkspaceOptions {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
}

export function usePlanningWorkspaceState({
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
}: PlanningWorkspaceOptions = {}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [timeEntries, setTimeEntries] = useState<Awaited<ReturnType<typeof getAllTimeEntries>>>([]);
  const [subView, setSubView] = useState<PlanningSubView>('list');
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [comparePlanId, setComparePlanId] = useState<string | null>(null);
  const [wrapUpPlan, setWrapUpPlan] = useState<Plan | null>(null);
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const { tasks, projects } = useTaskStore();
  const { workTypes } = useWorkTypeStore();
  const canComparePlans = getFeatureFlag('planningScenarioCompare');
  const initialNavigationAppliedRef = useRef(false);

  useEffect(() => {
    getAllPlans().then(setPlans);
  }, []);

  const reloadTimeEntries = useCallback(async () => {
    const entries = await getAllTimeEntries();
    setTimeEntries(entries);
  }, []);

  useEffect(() => {
    void reloadTimeEntries();
  }, [reloadTimeEntries]);

  useEffect(() => {
    let cancelled = false;

    async function loadKpis() {
      const completedTasks = tasks.filter((task) => task.status === 'completed');
      if (completedTasks.length === 0) {
        if (!cancelled) setKpis([]);
        return;
      }
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const outlierMode = getOutlierHandlingMode();
      const computed = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        workTypes,
        archiveOnly: true,
        outlierMode,
      });
      if (!cancelled) setKpis(computed);
    }

    void loadKpis();
    return () => {
      cancelled = true;
    };
  }, [tasks, workTypes]);

  useEffect(() => {
    if (initialNavigationAppliedRef.current) return;
    if (!initialPlanId) return;
    if (plans.length === 0) return;

    const requestedPlan = plans.find((plan) => plan.id === initialPlanId);
    initialNavigationAppliedRef.current = true;
    onInitialNavigationHandled?.();

    if (!requestedPlan) return;
    setActivePlan(requestedPlan);
    setSubView(initialSubView ?? 'edit');
  }, [initialPlanId, initialSubView, onInitialNavigationHandled, plans]);

  useEffect(() => {
    if (!canComparePlans && subView === 'compare') {
      setSubView('edit');
      setComparePlanId(null);
    }
  }, [canComparePlans, subView]);

  const comparison = useMemo(() => {
    if (!activePlan || !comparePlanId) return null;
    const comparePlan = plans.find((plan) => plan.id === comparePlanId);
    if (!comparePlan) return null;
    return comparePlans(activePlan, comparePlan);
  }, [activePlan, comparePlanId, plans]);

  const hasLinkedTasks = useMemo(() => {
    if (!activePlan) return false;
    return tasks.some((task) => task.sourcePlanId === activePlan.id);
  }, [activePlan, tasks]);
  const timeEntriesByTask = useMemo(
    () => buildTimeEntriesByTask(timeEntries),
    [timeEntries],
  );

  const handleCreatePlan = useCallback(async () => {
    const plan = createPlan('New Plan');
    await addPlan(plan);
    setPlans((prev) => [...prev, plan]);
    setActivePlan(plan);
    setSubView('edit');
  }, []);

  const handleSelectPlan = useCallback((plan: Plan) => {
    setActivePlan(plan);
    setSubView('edit');
  }, []);

  const handleSavePlan = useCallback(async (plan: Plan) => {
    await updatePlan(plan);
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
    setActivePlan(plan);
  }, []);

  const handleDeletePlan = useCallback(async (planId: string) => {
    await deletePlan(planId);
    setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    if (activePlan?.id === planId) {
      setActivePlan(null);
      setSubView('list');
    }
  }, [activePlan]);

  const handleBack = useCallback(() => {
    setSubView('list');
    setActivePlan(null);
    setComparePlanId(null);
  }, []);

  const openInsights = useCallback(() => {
    setSubView('insights');
  }, []);

  const openCompare = useCallback((planId: string) => {
    trackTelemetryEvent('planning_compare_open');
    setComparePlanId(planId);
    setSubView('compare');
  }, []);

  const openProgress = useCallback(async () => {
    await reloadTimeEntries();
    setSubView('progress');
  }, [reloadTimeEntries]);

  const openWrapUp = useCallback(async (plan: Plan) => {
    await reloadTimeEntries();
    setWrapUpPlan(plan);
  }, [reloadTimeEntries]);

  const closeWrapUp = useCallback(() => {
    setWrapUpPlan(null);
  }, []);

  const handleWrapUpCompleted = useCallback(async (updatedPlan: Plan) => {
    setPlans((prev) => prev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)));
    setActivePlan((prev) => (prev?.id === updatedPlan.id ? updatedPlan : prev));
    await refreshTasks();
  }, []);

  return {
    plans,
    timeEntries,
    timeEntriesByTask,
    subView,
    activePlan,
    comparePlanId,
    wrapUpPlan,
    kpis,
    tasks,
    projects,
    workTypes,
    canComparePlans,
    comparison,
    hasLinkedTasks,
    setSubView,
    handleCreatePlan,
    handleSelectPlan,
    handleSavePlan,
    handleDeletePlan,
    handleBack,
    openInsights,
    openCompare,
    openProgress,
    openWrapUp,
    reloadTimeEntries,
    closeWrapUp,
    handleWrapUpCompleted,
  };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkTypeStore } from '../../../lib/stores/work-type-store';
import {
  addPlan,
  deletePlan,
  getAllPlans,
  getAllTimeEntries,
  updatePlan,
} from '../../../lib/db';
import { createPlan, type Plan } from '../../../lib/planning/plan-model';
import { computeWorkTypeKpis, type WorkTypeKpi } from '../../../lib/kpi';
import { buildAttributedRollup } from '../../../lib/attributed-rollup';
import { getOutlierHandlingMode } from '../../../lib/stores/kpi-settings';
import { refreshTasks, useTaskStore } from '../../../lib/stores/task-store';
import { buildTimeEntriesByTask } from '../../../lib/time-entries-index';
import {
  subscribeToExecutionReturnImported,
  hasExecutionReturnImportPending,
  clearExecutionReturnImportPending,
} from '../../../lib/planning/execution-return-import-events';
import { isPlanInPlannerState } from '../../../lib/planning/plan-lifecycle';

/**
 * Shared planning data layer — owns loading, CRUD, and derived state.
 * Consumed by both desktop workspace and mobile stack navigation layers.
 */
export function usePlanningData() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [timeEntries, setTimeEntries] = useState<Awaited<ReturnType<typeof getAllTimeEntries>>>([]);
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const [wrapUpPlan, setWrapUpPlan] = useState<Plan | null>(null);
  const { tasks, projects } = useTaskStore();
  const { workTypes } = useWorkTypeStore();

  // --- Data loading ---

  useEffect(() => {
    getAllPlans().then((loaded) => {
      setPlans(loaded.filter(isPlanInPlannerState));
    });
  }, []);

  const reloadTimeEntries = useCallback(async () => {
    const entries = await getAllTimeEntries();
    setTimeEntries(entries);
  }, []);

  useEffect(() => {
    void reloadTimeEntries();
  }, [reloadTimeEntries]);

  // Reload when execution return was imported (e.g. user returns from Settings → Data Transfer)
  useEffect(() => {
    if (hasExecutionReturnImportPending()) {
      clearExecutionReturnImportPending();
      void reloadTimeEntries();
    }
    const unsubscribe = subscribeToExecutionReturnImported(() => {
      void reloadTimeEntries();
    });
    return unsubscribe;
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

  const timeEntriesByTask = useMemo(
    () => buildTimeEntriesByTask(timeEntries),
    [timeEntries],
  );

  // --- CRUD actions ---

  const handleCreatePlan = useCallback(async (): Promise<Plan> => {
    const plan = createPlan('');
    await addPlan(plan);
    setPlans((prev) => [...prev, plan]);
    return plan;
  }, []);

  const handleSavePlan = useCallback(async (plan: Plan) => {
    await updatePlan(plan);
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
  }, []);

  const handleDeletePlan = useCallback(async (planId: string) => {
    await deletePlan(planId);
    setPlans((prev) => prev.filter((plan) => plan.id !== planId));
  }, []);

  // --- Wrap-up ---

  const openWrapUp = useCallback(async (plan: Plan) => {
    await reloadTimeEntries();
    setWrapUpPlan(plan);
  }, [reloadTimeEntries]);

  const closeWrapUp = useCallback(() => {
    setWrapUpPlan(null);
  }, []);

  const handleWrapUpCompleted = useCallback(async (updatedPlan: Plan, success: boolean) => {
    setPlans((prev) => prev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)));
    await refreshTasks();
    if (success) {
      setWrapUpPlan(null);
    }
  }, []);

  // --- Derived helpers ---

  const hasLinkedTasksForPlan = useCallback(
    (planId: string) => tasks.some((task) => task.sourcePlanId === planId),
    [tasks],
  );

  return {
    // Data
    plans,
    timeEntries,
    timeEntriesByTask,
    kpis,
    tasks,
    projects,
    workTypes,
    wrapUpPlan,

    // CRUD
    handleCreatePlan,
    handleSavePlan,
    handleDeletePlan,

    // Wrap-up
    openWrapUp,
    closeWrapUp,
    handleWrapUpCompleted,

    // Derived
    hasLinkedTasksForPlan,
    reloadTimeEntries,
  };
}

export type PlanningData = ReturnType<typeof usePlanningData>;

/**
 * PlanningView — dedicated planning surface separate from Today execution flow.
 * Shows plan list, create/edit plan, work packages with KPI suggestions,
 * risk highlights, lock/save controls, and rationale notes.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import {
  getAllPlans,
  getAllTimeEntries,
  addPlan,
  updatePlan,
  deletePlan,
} from '../lib/db';
import {
  type Plan,
  createPlan,
} from '../lib/planning/plan-model';
import { comparePlans } from '../lib/planning/plan-compare';
import type { WorkTypeKpi } from '../lib/kpi';
import { computeWorkTypeKpis } from '../lib/kpi';
import { refreshTasks, useTaskStore } from '../lib/stores/task-store';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { getOutlierHandlingMode } from '../lib/stores/kpi-settings';
import { getFeatureFlag } from '../lib/flags/feature-flags';
import { trackTelemetryEvent } from '../lib/telemetry/telemetry';
import { PlanList } from './planning/PlanList';
import { PlanEditor } from './planning/PlanEditor';
import { CompareView } from './planning/CompareView';
import { ProgressView } from './planning/ProgressView';
import { WrapUpSheet } from './planning/WrapUpSheet';
import { InsightsView } from './planning/InsightsView';

type PlanningSubView = 'list' | 'edit' | 'compare' | 'progress' | 'insights';

interface PlanningViewProps {
  initialPlanId?: string | null;
  initialSubView?: 'edit' | 'progress' | 'insights';
  onInitialNavigationHandled?: () => void;
}

export function PlanningView({
  initialPlanId,
  initialSubView,
  onInitialNavigationHandled,
}: PlanningViewProps = {}) {
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

  // Load plans from DB
  useEffect(() => {
    getAllPlans().then(setPlans);
  }, []);

  // Load time entries for progress/wrap-up views.
  useEffect(() => {
    getAllTimeEntries().then(setTimeEntries);
  }, [tasks]);

  // Load KPIs for suggestions
  useEffect(() => {
    async function loadKpis() {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      if (completedTasks.length === 0) {
        setKpis([]);
        return;
      }
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const outlierMode = getOutlierHandlingMode();
      const computed = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        workTypes,
        archiveOnly: true,
        outlierMode,
      });
      setKpis(computed);
    }
    loadKpis();
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
    setPlans((prev) => prev.filter((p) => p.id !== planId));
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

  const hasLinkedTasks = useMemo(() => {
    if (!activePlan) return false;
    return tasks.some((task) => task.sourcePlanId === activePlan.id);
  }, [activePlan, tasks]);

  // Compare view
  const comparison = activePlan && comparePlanId
    ? comparePlans(activePlan, plans.find((p) => p.id === comparePlanId)!)
    : null;

  useEffect(() => {
    if (!canComparePlans && subView === 'compare') {
      setSubView('edit');
      setComparePlanId(null);
    }
  }, [canComparePlans, subView]);

  if (subView === 'list') {
    return (
      <>
        <PlanList
          plans={plans}
          tasks={tasks}
          onSelect={handleSelectPlan}
          onCreate={handleCreatePlan}
          onDelete={handleDeletePlan}
          onOpenWrapUp={(plan) => setWrapUpPlan(plan)}
          onOpenInsights={() => setSubView('insights')}
        />
        {wrapUpPlan && (
          <WrapUpSheet
            isOpen={wrapUpPlan != null}
            plan={wrapUpPlan}
            tasks={tasks}
            onClose={() => setWrapUpPlan(null)}
            onCompleted={async (updatedPlan) => {
              setPlans((prev) => prev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)));
              await refreshTasks();
            }}
          />
        )}
      </>
    );
  }

  if (subView === 'insights') {
    return (
      <div>
        <div className="planning-view__editor-header">
          <button className="planning-view__back" onClick={handleBack} aria-label="Back to plans">
            Plans
          </button>
        </div>
        <InsightsView tasks={tasks} workTypes={workTypes} />
      </div>
    );
  }

  if (canComparePlans && subView === 'compare' && activePlan && comparison) {
    return (
      <CompareView
        comparison={comparison}
        onBack={() => setSubView('edit')}
      />
    );
  }

  if (subView === 'edit' && activePlan) {
    return (
      <PlanEditor
        plan={activePlan}
        kpis={kpis}
        plans={plans}
        projects={projects}
        canComparePlans={canComparePlans}
        canOpenProgress={hasLinkedTasks}
        onSave={handleSavePlan}
        onBack={handleBack}
        onCompare={(planId) => {
          trackTelemetryEvent('planning_compare_open');
          setComparePlanId(planId);
          setSubView('compare');
        }}
        onOpenProgress={() => setSubView('progress')}
      />
    );
  }

  if (subView === 'progress' && activePlan) {
    return (
      <>
        <ProgressView
          plan={activePlan}
          tasks={tasks}
          timeEntries={timeEntries}
          onBack={() => setSubView('edit')}
          onWrapUp={() => setWrapUpPlan(activePlan)}
        />
        {wrapUpPlan && (
          <WrapUpSheet
            isOpen={wrapUpPlan != null}
            plan={wrapUpPlan}
            tasks={tasks}
            onClose={() => setWrapUpPlan(null)}
            onCompleted={async (updatedPlan) => {
              setPlans((prev) => prev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)));
              setActivePlan(updatedPlan);
              await refreshTasks();
            }}
          />
        )}
      </>
    );
  }

  return null;
}

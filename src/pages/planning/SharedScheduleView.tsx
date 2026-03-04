import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../../lib/types';
import type { Plan, PlanLineItem, WorkCalendarDay } from '../../lib/planning/plan-model';
import { isPlanArchived } from '../../lib/planning/plan-lifecycle';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { computeSharedCapacitySummary } from '../../lib/planning/scheduling/capacity';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from '../../lib/planning/scheduling/crew-pool-calendar';
import { buildSharedRows } from '../../lib/planning/scheduling/schedule-hierarchy';
import {
  setSharedCrewForDate,
  toggleSharedAssignment,
} from '../../lib/planning/scheduling/shared-schedule-mutations';
import { syncPlanWorkCalendarFromCrewPool } from '../../lib/planning/scheduling/plan-schedule-update';
import type { ScheduledLineItemRef } from '../../lib/planning/scheduling/shared-schedule-types';
import { FeasibilityBar } from './schedule/FeasibilityBar';
import { ConflictResolutionBanner } from './schedule/ConflictResolutionBanner';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { readPhaseDateValues } from './schedule/schedule-date-ui';
import {
  loadCrewPoolOverride,
  saveCrewPoolOverride,
} from './hooks/useCrewPoolStorage';

const AUTOSAVE_DELAY = 500;

interface SharedScheduleViewProps {
  plans: Plan[];
  projects: Project[];
  selectedPlanIds: Set<string>;
  onSelectedPlanIdsChange: (planIds: Set<string>) => void;
  onSavePlan: (plan: Plan) => void;
}

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function normalizeCrew(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function getStatusLabel(plan: Plan): string {
  if (plan.status === 'draft') return 'Draft';
  if (plan.status === 'active') return 'Active';
  if (plan.status === 'reviewed') return 'Reviewed';
  return plan.status;
}

export function SharedScheduleView({
  plans,
  projects,
  selectedPlanIds,
  onSelectedPlanIdsChange,
  onSavePlan,
}: SharedScheduleViewProps) {
  const initSelectionRef = useRef(false);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSavesRef = useRef<Map<string, Plan>>(new Map());
  const [optimisticPlansById, setOptimisticPlansById] = useState<Map<string, Plan>>(new Map());
  const [crewPoolCalendar, setCrewPoolCalendar] = useState<WorkCalendarDay[]>([]);
  const [crewPoolDefaultCrewSize, setCrewPoolDefaultCrewSize] = useState<number>(0);

  const selectablePlans = useMemo(
    () => plans.filter((plan) => plan.status === 'draft' || plan.status === 'active' || plan.status === 'reviewed'),
    [plans],
  );

  const plansById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  const effectivePlansById = useMemo(() => {
    const merged = new Map(plansById);
    for (const [planId, optimisticPlan] of optimisticPlansById) {
      merged.set(planId, optimisticPlan);
    }
    return merged;
  }, [plansById, optimisticPlansById]);

  const effectivePlansByIdRef = useRef(effectivePlansById);
  useEffect(() => {
    effectivePlansByIdRef.current = effectivePlansById;
  }, [effectivePlansById]);

  useEffect(() => {
    trackTelemetryEvent('shared_schedule_tab_open');
  }, []);

  useEffect(() => {
    if (initSelectionRef.current) return;
    if (selectablePlans.length === 0) return;
    if (selectedPlanIds.size > 0) {
      initSelectionRef.current = true;
      return;
    }
    const defaults = selectablePlans
      .filter((plan) => plan.status === 'draft' || plan.status === 'active')
      .map((plan) => plan.id);
    if (defaults.length > 0) {
      onSelectedPlanIdsChange(new Set(defaults));
      trackTelemetryEvent('shared_schedule_plan_selection_change');
    }
    initSelectionRef.current = true;
  }, [onSelectedPlanIdsChange, selectablePlans, selectedPlanIds]);

  useEffect(() => {
    setOptimisticPlansById((prev) => {
      let changed = false;
      const next = new Map(prev);

      for (const [planId, optimistic] of prev) {
        const persisted = plansById.get(planId);
        if (!persisted) {
          next.delete(planId);
          pendingSavesRef.current.delete(planId);
          const existingTimer = saveTimersRef.current.get(planId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            saveTimersRef.current.delete(planId);
          }
          changed = true;
          continue;
        }

        if (persisted.updatedAt === optimistic.updatedAt) {
          next.delete(planId);
          pendingSavesRef.current.delete(planId);
          const existingTimer = saveTimersRef.current.get(planId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            saveTimersRef.current.delete(planId);
          }
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [plansById]);

  useEffect(() => {
    return () => {
      for (const timer of saveTimersRef.current.values()) {
        clearTimeout(timer);
      }
      saveTimersRef.current.clear();
      for (const plan of pendingSavesRef.current.values()) {
        onSavePlan(plan);
      }
      pendingSavesRef.current.clear();
    };
  }, [onSavePlan]);

  const queuePlanSave = useCallback((plan: Plan) => {
    setOptimisticPlansById((prev) => {
      const next = new Map(prev);
      next.set(plan.id, plan);
      return next;
    });

    pendingSavesRef.current.set(plan.id, plan);

    const existingTimer = saveTimersRef.current.get(plan.id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      saveTimersRef.current.delete(plan.id);
      const pendingPlan = pendingSavesRef.current.get(plan.id);
      if (!pendingPlan) return;
      pendingSavesRef.current.delete(plan.id);
      onSavePlan(pendingPlan);
    }, AUTOSAVE_DELAY);

    saveTimersRef.current.set(plan.id, timer);
  }, [onSavePlan]);

  const selectedPlans = useMemo(
    () => selectablePlans
      .filter((plan) => selectedPlanIds.has(plan.id))
      .map((plan) => effectivePlansById.get(plan.id) ?? plan),
    [effectivePlansById, selectablePlans, selectedPlanIds],
  );

  const crewPoolSourceKey = useMemo(
    () => selectedPlans
      .map((plan) => [
        plan.id,
        plan.eventStartDate ?? '',
        plan.eventEndDate ?? '',
        plan.buildUpStartDate ?? '',
        plan.buildUpEndDate ?? '',
        plan.tearDownStartDate ?? '',
        plan.tearDownEndDate ?? '',
        String(plan.defaultCrewSize ?? ''),
      ].join(':'))
      .join('|'),
    [selectedPlans],
  );

  const derivedDefaultCrewSize = useMemo(
    () => deriveCrewPoolDefaultCrewSize(selectedPlans),
    [selectedPlans],
  );

  useEffect(() => {
    if (selectedPlans.length === 0) {
      setCrewPoolDefaultCrewSize(0);
      setCrewPoolCalendar([]);
      return;
    }

    const stored = loadCrewPoolOverride(crewPoolSourceKey);
    if (stored) {
      setCrewPoolDefaultCrewSize(stored.defaultCrewSize);
      setCrewPoolCalendar(stored.calendar);
      return;
    }

    setCrewPoolDefaultCrewSize(derivedDefaultCrewSize);
    setCrewPoolCalendar((prev) => deriveCrewPoolCalendar(selectedPlans, {
      defaultCrewSize: derivedDefaultCrewSize,
      existingCalendar: prev.length > 0 ? prev : undefined,
    }));
  }, [crewPoolSourceKey, derivedDefaultCrewSize, selectedPlans.length]);

  useEffect(() => {
    if (selectedPlans.length === 0 || crewPoolCalendar.length === 0) return;
    saveCrewPoolOverride(crewPoolSourceKey, crewPoolCalendar, crewPoolDefaultCrewSize);
  }, [crewPoolSourceKey, crewPoolCalendar, crewPoolDefaultCrewSize, selectedPlans.length]);

  const selectedProjectNamesByPlanId = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project.name]));
    const names = new Map<string, string>();
    for (const plan of selectedPlans) {
      if (!plan.projectId) continue;
      const projectName = projectById.get(plan.projectId);
      if (projectName) names.set(plan.id, projectName);
    }
    return names;
  }, [projects, selectedPlans]);

  const planTitleByPlanId = useMemo(() => {
    const titles = new Map<string, string>();
    for (const plan of selectedPlans) {
      titles.set(plan.id, plan.title);
    }
    return titles;
  }, [selectedPlans]);

  const lineItemRefs = useMemo(() => {
    const refs: ScheduledLineItemRef[] = [];
    for (const plan of selectedPlans) {
      const readOnly = isPlanArchived(plan);
      for (const item of plan.lineItems) {
        refs.push({
          planId: plan.id,
          lineItemId: item.id,
          plan,
          item,
          readOnly,
        });
      }
    }
    return refs;
  }, [selectedPlans]);

  const itemByCompositeId = useMemo(() => {
    const map = new Map<string, PlanLineItem>();
    for (const ref of lineItemRefs) {
      map.set(mapKey(ref.planId, ref.lineItemId), ref.item);
    }
    return map;
  }, [lineItemRefs]);

  const rows = useMemo(() => buildSharedRows(selectedPlans), [selectedPlans]);

  const phaseDatesByPlanId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof readPhaseDateValues>>();
    for (const plan of selectedPlans) {
      map.set(plan.id, readPhaseDateValues(plan));
    }
    return map;
  }, [selectedPlans]);

  const capacity = useMemo(() => computeSharedCapacitySummary({
    calendar: crewPoolCalendar,
    defaultCrewSize: crewPoolDefaultCrewSize,
    lineItems: lineItemRefs,
  }), [crewPoolCalendar, crewPoolDefaultCrewSize, lineItemRefs]);

  const applyPlanMutation = useCallback((
    planId: string,
    mutate: (plan: Plan) => Plan,
  ): boolean => {
    const currentPlan = effectivePlansByIdRef.current.get(planId);
    if (!currentPlan) return false;
    const nextPlan = mutate(currentPlan);
    if (nextPlan === currentPlan || nextPlan.updatedAt === currentPlan.updatedAt) return false;
    queuePlanSave(nextPlan);
    return true;
  }, [queuePlanSave]);

  const handleToggleAssignment = useCallback((
    planId: string,
    lineItemId: string,
    date: string,
  ) => {
    const changed = applyPlanMutation(planId, (plan) => toggleSharedAssignment(plan, lineItemId, date));
    if (changed) {
      trackTelemetryEvent('shared_schedule_assignment_edit');
    }
  }, [applyPlanMutation]);

  const handleCrewForDateChange = useCallback((
    planId: string,
    lineItemId: string,
    date: string,
    crew: number,
  ) => {
    const changed = applyPlanMutation(planId, (plan) => setSharedCrewForDate(plan, lineItemId, date, crew));
    if (changed) {
      trackTelemetryEvent('shared_schedule_assignment_edit');
    }
  }, [applyPlanMutation]);

  const handleTogglePlanSelection = useCallback((planId: string, checked: boolean) => {
    const next = new Set(selectedPlanIds);
    if (checked) next.add(planId);
    else next.delete(planId);
    onSelectedPlanIdsChange(next);
    trackTelemetryEvent('shared_schedule_plan_selection_change');
  }, [onSelectedPlanIdsChange, selectedPlanIds]);

  const handleDefaultCrewSizeChange = (value: string) => {
    setCrewPoolDefaultCrewSize(normalizeCrew(value));
    trackTelemetryEvent('shared_schedule_crew_pool_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<WorkCalendarDay>) => {
    setCrewPoolCalendar((prev) => prev.map((day) => (
      day.date === date ? { ...day, ...updates } : day
    )));
    // Propagate to each plan so assignment/crew mutations persist (they use plan.workCalendar)
    for (const plan of selectedPlans) {
      if (isPlanArchived(plan)) continue;
      const updated = syncPlanWorkCalendarFromCrewPool(plan, date, updates);
      if (updated !== plan) queuePlanSave(updated);
    }
    trackTelemetryEvent('shared_schedule_crew_pool_edit');
  };

  return (
    <div className="planning-view schedule-view">
      <header className="planning-view__editor-header">
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Shared Schedule
        </h2>
      </header>

      <section className="schedule-view__block">
        <header className="schedule-view__block-header">
          <h3 className="schedule-view__block-title">
            Plan Selection ({selectedPlanIds.size})
          </h3>
        </header>
        {selectablePlans.length === 0 ? (
          <p className="schedule-view__muted">No plans available.</p>
        ) : (
          <div className="shared-schedule__plan-selector" role="group" aria-label="Shared schedule plan selection">
            {selectablePlans.map((plan) => {
              const projectName = plan.projectId
                ? projects.find((project) => project.id === plan.projectId)?.name ?? 'Unknown project'
                : 'No project';
              const checked = selectedPlanIds.has(plan.id);
              return (
                <label key={plan.id} className="shared-schedule__plan-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => handleTogglePlanSelection(plan.id, event.target.checked)}
                  />
                  <span className="shared-schedule__plan-option-title">{plan.title}</span>
                  <span className="shared-schedule__plan-option-meta">{projectName} · {getStatusLabel(plan)}</span>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {selectedPlans.length === 0 ? (
        <section className="schedule-view__block">
          <p className="schedule-view__muted">Select at least one plan to build a shared schedule.</p>
        </section>
      ) : (
        <>
          <FeasibilityBar capacity={capacity} />
          <ConflictResolutionBanner capacity={capacity} />

          <section className="schedule-view__block schedule-view__block--compact">
            <header className="schedule-view__block-header">
              <h3 className="schedule-view__block-title">Crew Pool</h3>
            </header>
            <div className="planning-view__schedule-group-grid planning-view__schedule-group-grid--single">
              <label className="planning-view__schedule-input">
                <span className="planning-view__schedule-label-text">Global default crew</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={crewPoolDefaultCrewSize}
                  onChange={(event) => handleDefaultCrewSizeChange(event.target.value)}
                />
              </label>
            </div>
          </section>

          <WorkCalendarEditor
            calendar={crewPoolCalendar}
            readOnly={false}
            onUpdateDay={handleUpdateCalendarDay}
            planDefaultCrewSize={crewPoolDefaultCrewSize}
          />

          <ScheduleGrid
            mode="shared"
            rows={rows}
            calendar={crewPoolCalendar}
            capacity={capacity}
            phaseDatesByPlanId={phaseDatesByPlanId}
            planTitleByPlanId={planTitleByPlanId}
            projectNameByPlanId={selectedProjectNamesByPlanId}
            itemByCompositeId={itemByCompositeId}
            onToggleAssignment={handleToggleAssignment}
            onCrewForDateChange={handleCrewForDateChange}
          />
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project } from '../../lib/types';
import type { Plan, PlanLineItem, WorkCalendarDay } from '../../lib/planning/plan-model';
import { isPlanArchived, isPlanInPlannerState } from '../../lib/planning/plan-lifecycle';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  computeSharedCapacitySummary,
  type CapacitySummary,
} from '../../lib/planning/scheduling/capacity';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from '../../lib/planning/scheduling/crew-pool-calendar';
import { buildSharedRows } from '../../lib/planning/scheduling/schedule-hierarchy';
import {
  setSharedCrewForDate,
  toggleSharedAssignment,
} from '../../lib/planning/scheduling/shared-schedule-mutations';
import {
  syncPlanWorkCalendarFromCrewPool,
  syncCrewPoolCalendarToPlan,
} from '../../lib/planning/scheduling/plan-schedule-update';
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
import { useSharedSchedulePersistence } from './hooks/useSharedSchedulePersistence';

const AUTOSAVE_DELAY = 500;

interface SharedScheduleViewProps {
  plans: Plan[];
  projects: Project[];
  selectedPlanIds: Set<string>;
  onSavePlan: (plan: Plan) => void;
  /** Called when capacity is computed; used by sidebar to show matching utilization. Pass null when no plans selected. */
  onCapacityChange?: (capacity: CapacitySummary | null) => void;
}

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function normalizeCrew(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function SharedScheduleView({
  plans,
  projects,
  selectedPlanIds,
  onSavePlan,
  onCapacityChange,
}: SharedScheduleViewProps) {
  const [crewPoolCalendar, setCrewPoolCalendar] = useState<WorkCalendarDay[]>([]);
  const [crewPoolDefaultCrewSize, setCrewPoolDefaultCrewSize] = useState<number>(0);

  const selectablePlans = useMemo(
    () => plans.filter(isPlanInPlannerState),
    [plans],
  );

  const plansById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  const {
    effectivePlansById,
    applyPlanMutation,
  } = useSharedSchedulePersistence({
    plansById,
    onSavePlan,
    autosaveDelay: AUTOSAVE_DELAY,
  });

  useEffect(() => {
    trackTelemetryEvent('shared_schedule_tab_open');
  }, []);

  /* No default selection — user explicitly adds plans via sidebar button */

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

  useEffect(() => {
    if (onCapacityChange) {
      onCapacityChange(selectedPlans.length > 0 ? capacity : null);
    }
  }, [capacity, selectedPlans.length, onCapacityChange]);

  const handleToggleAssignment = useCallback((
    planId: string,
    lineItemId: string,
    date: string,
  ) => {
    if (applyPlanMutation(planId, (plan) => toggleSharedAssignment(plan, lineItemId, date))) {
      trackTelemetryEvent('shared_schedule_assignment_edit');
    }
  }, [applyPlanMutation]);

  const handleCrewForDateChange = useCallback((
    planId: string,
    lineItemId: string,
    date: string,
    crew: number,
  ) => {
    if (applyPlanMutation(planId, (plan) => setSharedCrewForDate(plan, lineItemId, date, crew))) {
      trackTelemetryEvent('shared_schedule_assignment_edit');
    }
  }, [applyPlanMutation]);

  const handleDefaultCrewSizeChange = (value: string) => {
    const newCrew = normalizeCrew(value);
    setCrewPoolDefaultCrewSize(newCrew);
    // Clear per-day crew overrides so all days inherit the new global default.
    const clearedCalendar = crewPoolCalendar.map((day) =>
      ({ ...day, crewSize: day.isWorkDay ? null : day.crewSize }));
    setCrewPoolCalendar(clearedCalendar);
    // Sync the crew pool calendar to each plan in one mutation per plan.
    // This ensures the global default overrides any locally set crew on plans.
    for (const plan of selectedPlans) {
      if (isPlanArchived(plan)) continue;
      applyPlanMutation(plan.id, (currentPlan) =>
        syncCrewPoolCalendarToPlan(currentPlan, clearedCalendar, newCrew),
      );
    }
    trackTelemetryEvent('shared_schedule_crew_pool_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<WorkCalendarDay>) => {
    setCrewPoolCalendar((prev) => prev.map((day) => (
      day.date === date ? { ...day, ...updates } : day
    )));
    // Propagate to each plan so assignment/crew mutations persist (they use plan.workCalendar)
    for (const plan of selectedPlans) {
      if (isPlanArchived(plan)) continue;
      applyPlanMutation(plan.id, (currentPlan) => syncPlanWorkCalendarFromCrewPool(currentPlan, date, updates));
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

      {selectedPlans.length === 0 ? (
        <section className="schedule-view__block">
          <p className="schedule-view__muted">Select at least one plan to build a shared schedule.</p>
        </section>
      ) : (
        <>
          <FeasibilityBar capacity={capacity} />
          <ConflictResolutionBanner capacity={capacity} />

          <section className="schedule-view__block schedule-view__block--compact schedule-view__block--row">
            <h3 className="schedule-view__block-title">Crew Pool</h3>
            <fieldset className="planning-view__schedule-group">
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
            </fieldset>
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

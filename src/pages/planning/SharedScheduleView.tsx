import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTagSequenceStore } from '../../lib/stores/tag-sequence-store';
import { useTagStore } from '../../lib/stores/tag-store';
import { useCrewPoolStore } from '../../lib/stores/crew-pool-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import type { BuildPhase, Project } from '../../lib/types';
import { getPlanDisplayName, type Plan, type PlanLineItem, type WorkCalendarDay } from '../../lib/planning/plan-model';
import { isPlanArchived, isPlanInPlannerState } from '../../lib/planning/plan-lifecycle';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  computeSharedCapacitySummary,
} from '../../lib/planning/scheduling/capacity';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from '../../lib/planning/scheduling/crew-pool-calendar';
import { buildSharedRows } from '../../lib/planning/scheduling/schedule-hierarchy';
import {
  setSharedPersonHoursForDate,
  toggleSharedAssignment,
} from '../../lib/planning/scheduling/shared-schedule-mutations';
import {
  syncPlanWorkCalendarFromCrewPool,
  syncCrewPoolCalendarToPlan,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  applyBulkScheduleAmendment,
  type BulkScheduleAmendmentChange,
} from '../../lib/planning/scheduling/amendments';
import {
  runSharedAutoSchedule,
  type SharedAutoScheduleReport,
} from '../../lib/planning/scheduling/shared-auto-schedule';
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
}

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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
}: SharedScheduleViewProps) {
  const [crewPoolCalendar, setCrewPoolCalendar] = useState<WorkCalendarDay[]>([]);
  const [crewPoolDefaultCrewSize, setCrewPoolDefaultCrewSize] = useState<number>(0);
  const [assistantReport, setAssistantReport] = useState<SharedAutoScheduleReport | null>(null);
  const { tags } = useTagStore();
  const { tagIds: storedSequenceTagIds } = useTagSequenceStore();
  const { allocations: crewPoolAllocations, defaultCrewSize: crewPoolSystemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor } = useCrewPoolStore();
  const { workTypes } = useWorkTypeStore();
  const workTypesById = useMemo(() => new Map(workTypes.map((wt) => [wt.id, wt])), [workTypes]);

  // Build the full execution sequence: explicitly-ordered tags first, then any
  // sequencable tags not yet saved to the sequence (alphabetical). This mirrors
  // SettingsTagSequenceView so the assistant always respects all sequencable tags
  // even when the user hasn't visited the sequence settings view yet.
  const sequenceTagIds = useMemo(() => {
    const sequencableTags = tags.filter((t) => t.sequencable);
    if (sequencableTags.length === 0) return [];
    const sequenceSet = new Set(storedSequenceTagIds);
    const positionMap = new Map(storedSequenceTagIds.map((id, i) => [id, i]));
    const inSequence = sequencableTags
      .filter((t) => sequenceSet.has(t.id))
      .sort((a, b) => (positionMap.get(a.id) ?? 0) - (positionMap.get(b.id) ?? 0));
    const notInSequence = sequencableTags
      .filter((t) => !sequenceSet.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...inSequence, ...notInSequence].map((t) => t.id);
  }, [tags, storedSequenceTagIds]);

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
        plan.assemblyStartDate ?? '',
        plan.assemblyEndDate ?? '',
        plan.dismantleStartDate ?? '',
        plan.dismantleEndDate ?? '',
        String(plan.defaultCrewSize ?? ''),
      ].join(':'))
      .join('|'),
    [selectedPlans],
  );

  const lastSyncedCrewPoolKeyRef = useRef<string | null>(null);

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
      // Sync stored overrides (e.g. weekend toggles) to plans so plan.workCalendar
      // matches the crew pool. Without this, plans block allocation on days the
      // crew pool marks as work days.
      if (lastSyncedCrewPoolKeyRef.current !== crewPoolSourceKey) {
        lastSyncedCrewPoolKeyRef.current = crewPoolSourceKey;
        for (const plan of selectedPlans) {
          if (isPlanArchived(plan)) continue;
          applyPlanMutation(plan.id, (p) =>
            syncCrewPoolCalendarToPlan(p, stored.calendar, stored.defaultCrewSize),
          );
        }
      }
      return;
    }

    lastSyncedCrewPoolKeyRef.current = null;
    setCrewPoolDefaultCrewSize(derivedDefaultCrewSize);
    setCrewPoolCalendar((prev) => deriveCrewPoolCalendar(selectedPlans, {
      defaultCrewSize: derivedDefaultCrewSize,
      existingCalendar: prev.length > 0 ? prev : undefined,
    }));
  }, [crewPoolSourceKey, derivedDefaultCrewSize, selectedPlans, selectedPlans.length]);

  useEffect(() => {
    if (selectedPlans.length === 0 || crewPoolCalendar.length === 0) return;
    saveCrewPoolOverride(crewPoolSourceKey, crewPoolCalendar, crewPoolDefaultCrewSize);
  }, [crewPoolSourceKey, crewPoolCalendar, crewPoolDefaultCrewSize, selectedPlans.length]);

  const planDisplayNameByPlanId = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const names = new Map<string, string>();
    for (const plan of selectedPlans) {
      names.set(
        plan.id,
        getPlanDisplayName(plan, plan.projectId ? projectById.get(plan.projectId) ?? null : null),
      );
    }
    return names;
  }, [projects, selectedPlans]);

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

  const handleToggleAssignment = useCallback((
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
  ) => {
    if (applyPlanMutation(planId, (plan) => toggleSharedAssignment(plan, lineItemId, phase, date))) {
      trackTelemetryEvent('shared_schedule_assignment_edit');
    }
  }, [applyPlanMutation]);

  const handlePersonHoursForDateChange = useCallback((
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    personHours: number,
  ) => {
    if (applyPlanMutation(planId, (plan) => setSharedPersonHoursForDate(plan, lineItemId, phase, date, personHours))) {
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

  const handleAutoScheduleShared = () => {
    // Only schedule non-archived plans
    const mutablePlans = selectedPlans.filter((plan) => !isPlanArchived(plan));
    if (mutablePlans.length === 0) return;

    const tagSequence = sequenceTagIds.length > 0
      ? { id: 'global' as const, tagIds: sequenceTagIds, updatedAt: '' }
      : undefined;
    const crewPool = (Object.keys(crewPoolAllocations).length > 0 || crewPoolSystemDefaultCrewSize != null)
      ? { id: 'global' as const, defaultCrewSize: crewPoolSystemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor, allocations: crewPoolAllocations, updatedAt: '' }
      : undefined;
    const { planUpdatesById, report } = runSharedAutoSchedule({
      plans: mutablePlans,
      calendar: crewPoolCalendar,
      defaultCrewSize: crewPoolDefaultCrewSize,
      tagSequence,
      crewPool,
      workTypes: workTypesById,
    });

    if (report.changed.length === 0) {
      setAssistantReport(report);
      return;
    }

    // Check if any active plans were changed — require one global amendment note
    const changedPlanIds = new Set(report.changed.map((row) => row.planId));
    const hasActivePlanChanges = mutablePlans.some(
      (plan) => plan.status === 'active' && changedPlanIds.has(plan.id),
    );

    let amendmentNote: string | null = null;
    if (hasActivePlanChanges) {
      const note = window.prompt('Shared assistant run amendment note (required for active plans):', '');
      if (note == null) return;
      if (note.trim().length === 0) {
        window.alert('Amendment note is required for assistant runs affecting active plans.');
        return;
      }
      amendmentNote = note.trim();
    }

    // Group changes by planId
    const changesByPlanId = new Map<string, BulkScheduleAmendmentChange[]>();
    for (const row of report.changed) {
      const existing = changesByPlanId.get(row.planId) ?? [];
      existing.push({
        lineItemId: row.lineItemId,
        phase: row.phase,
        scheduledStart: row.scheduledStart,
        scheduledEnd: row.scheduledEnd,
      });
      changesByPlanId.set(row.planId, existing);
    }

    // Apply mutations plan-by-plan
    for (const plan of mutablePlans) {
      const updatedPlan = planUpdatesById.get(plan.id);
      if (!updatedPlan || updatedPlan === plan) continue;

      const planChanges = changesByPlanId.get(plan.id);
      if (plan.status === 'active' && planChanges && planChanges.length > 0 && amendmentNote) {
        // Apply bulk amendment with note for active plans
        applyPlanMutation(plan.id, () =>
          applyBulkScheduleAmendment(plan, updatedPlan, planChanges, amendmentNote),
        );
      } else {
        // Draft/reviewed plans: apply schedule changes directly
        applyPlanMutation(plan.id, () => updatedPlan);
      }
    }

    setAssistantReport(report);
    trackTelemetryEvent('shared_schedule_assignment_edit');
    trackTelemetryEvent('shared_schedule_assistant_run', {
      changed_count: report.changed.length,
      changed_plan_count: changedPlanIds.size,
      unresolved_count: report.unresolved.length,
      coverage_ratio_before: report.before.coverageRatio,
      coverage_ratio_after: report.after.coverageRatio,
      over_capacity_days_before: report.before.overCapacityDays,
      over_capacity_days_after: report.after.overCapacityDays,
    });
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
            {assistantReport && (
              <section className="schedule-view__block schedule-view__block--compact" aria-live="polite">
                <h3 className="schedule-view__block-title">Assistant Run Summary</h3>
                <p className="schedule-view__muted">
                  {assistantReport.changed.length} updated across {new Set(assistantReport.changed.map((r) => r.planId)).size} plan{new Set(assistantReport.changed.map((r) => r.planId)).size === 1 ? '' : 's'} · {assistantReport.unresolved.length} unresolved
                </p>
                <p className="schedule-view__muted">
                  Coverage {toPercent(assistantReport.before.coverageRatio)} → {toPercent(assistantReport.after.coverageRatio)}
                  {' · '}
                  Over-capacity days {assistantReport.before.overCapacityDays} → {assistantReport.after.overCapacityDays}
                </p>
              </section>
            )}

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
            planDisplayNameByPlanId={planDisplayNameByPlanId}
            itemByCompositeId={itemByCompositeId}
            onAutoSchedule={handleAutoScheduleShared}
            onToggleAssignment={handleToggleAssignment}
            onPersonHoursForDateChange={handlePersonHoursForDateChange}
          />
        </>
      )}
    </div>
  );
}

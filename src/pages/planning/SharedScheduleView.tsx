import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTagSequenceStore } from '../../lib/stores/tag-sequence-store';
import { useTagStore } from '../../lib/stores/tag-store';
import { useCrewPoolStore } from '../../lib/stores/crew-pool-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { isProjectColorUnassigned, type BuildPhase, type Project } from '../../lib/types';
import { getPlanDisplayName, type Plan, type PlanLineItem, type WorkCalendarDay } from '../../lib/planning/plan-model';
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
  setSharedPersonHoursForDate,
  toggleSharedAssignment,
} from '../../lib/planning/scheduling/shared-schedule-mutations';
import {
  addExtendedZoneDayToPlan,
  syncPlanWorkCalendarFromCrewPool,
  syncCrewPoolCalendarToPlan,
  updatePlanCalendarDay,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  applyBulkScheduleAmendment,
  type BulkScheduleAmendmentChange,
} from '../../lib/planning/scheduling/amendments';
import { runSharedAutoSchedule } from '../../lib/planning/scheduling/shared-auto-schedule';
import type { ScheduledLineItemRef, SharedScheduleRow } from '../../lib/planning/scheduling/shared-schedule-types';
import { ScheduleMetricStrip } from './schedule/ScheduleMetricStrip';
import { ScheduleGrid, type ScheduleGridEventDates } from './schedule/ScheduleGrid';
import { DayEditPopover } from './schedule/grid/DayEditPopover';
import { buildSharedCapacityMetrics } from './workspace/workspace-metrics';
import {
  getFullEventSpan,
  getWorkCalendarPhaseSpans,
  isDateWithinAnySpan,
  isDateWithinSpan,
  readPhaseDateValues,
  type PhaseDateValues,
} from './schedule/schedule-date-ui';
import { generateFullSpanVirtualDays } from '../../lib/planning/scheduling/work-calendar';
import {
  loadCrewPoolOverride,
  saveCrewPoolOverride,
} from './hooks/useCrewPoolStorage';
import { useSharedSchedulePersistence } from './hooks/useSharedSchedulePersistence';
import { type SharedScheduleContextValue } from './workspace/SharedScheduleContext';

const AUTOSAVE_DELAY = 500;

interface SharedScheduleViewProps {
  plans: Plan[];
  projects: Project[];
  selectedPlanIds: Set<string>;
  onSavePlan: (plan: Plan) => void;
  onSharedScheduleContextChange?: (ctx: SharedScheduleContextValue | null) => void;
}

interface SharedScheduleWorkspaceSectionsProps {
  selectedPlans: Plan[];
  capacity: CapacitySummary;
  crewPoolCalendar: WorkCalendarDay[];
  displayCalendar: WorkCalendarDay[];
  crewPoolDefaultCrewSize: number;
  showFullSpan: boolean;
  onToggleFullSpan?: () => void;
  rows: SharedScheduleRow[];
  phaseDatesByPlanId: Map<string, PhaseDateValues>;
  eventDatesByPlanId: Map<string, ScheduleGridEventDates>;
  planDisplayNameByPlanId: Map<string, string>;
  projectAccentColorByPlanId: Map<string, string>;
  itemByCompositeId: Map<string, PlanLineItem>;
  onUpdateCalendarDay: (date: string, updates: Partial<WorkCalendarDay>) => void;
  onAutoScheduleShared: () => void;
  onToggleWorkday: (date: string) => void;
  onEditDay: (date: string, anchor: HTMLElement) => void;
  dayEdit: { date: string; anchor: HTMLElement } | null;
  onCloseDayEdit: () => void;
  onToggleAssignment: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    cellElement?: HTMLElement,
  ) => void;
  onPersonHoursForDateChange: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    personHours: number,
  ) => void;
}

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function normalizeCrew(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function buildSharedCrewPoolWorkDay(date: string): WorkCalendarDay {
  return {
    date,
    isWorkDay: true,
    accessStart: '08:00',
    accessEnd: '16:00',
    crewSize: null,
    efficiency: null,
  };
}

function sortCalendarDays(days: WorkCalendarDay[]): WorkCalendarDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

export function updateSharedCrewPoolCalendarDay(
  calendar: WorkCalendarDay[],
  date: string,
  updates: Partial<WorkCalendarDay>,
): WorkCalendarDay[] {
  const existing = calendar.find((day) => day.date === date);
  if (existing) {
    return calendar.map((day) => (
      day.date === date ? { ...day, ...updates } : day
    ));
  }
  return sortCalendarDays([...calendar, { ...buildSharedCrewPoolWorkDay(date), ...updates, date }]);
}

export function syncSharedCrewPoolDayToPlan(
  plan: Plan,
  date: string,
  updates: Partial<WorkCalendarDay>,
): Plan {
  const fullSpan = getFullEventSpan(plan, plan.eventStartDate, plan.eventEndDate);
  if (!isDateWithinSpan(date, fullSpan)) return plan;

  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(plan));
  if (isDateWithinAnySpan(date, phaseSpans)) {
    return syncPlanWorkCalendarFromCrewPool(plan, date, updates);
  }

  const existing = plan.workCalendar.find((day) => day.date === date);
  if (existing) {
    return updatePlanCalendarDay(plan, date, updates);
  }
  if (updates.isWorkDay === false) return plan;
  return addExtendedZoneDayToPlan(plan, date);
}

export function SharedScheduleView({
  plans,
  projects,
  selectedPlanIds,
  onSavePlan,
  onSharedScheduleContextChange,
}: SharedScheduleViewProps) {
  const [crewPoolCalendar, setCrewPoolCalendar] = useState<WorkCalendarDay[]>([]);
  const [crewPoolDefaultCrewSize, setCrewPoolDefaultCrewSize] = useState<number>(0);
  const [showFullSpan, setShowFullSpan] = useState(false);
  const [dayEdit, setDayEdit] = useState<{ date: string; anchor: HTMLElement } | null>(null);
  const { tags } = useTagStore();
  const { tagIds: storedSequenceTagIds } = useTagSequenceStore();
  const { allocations: crewPoolAllocations, dailyDeployments: crewPoolDailyDeployments, defaultCrewSize: crewPoolSystemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor } = useCrewPoolStore();
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

  const projectAccentColorByPlanId = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const colors = new Map<string, string>();
    for (const plan of selectedPlans) {
      const project = plan.projectId ? projectById.get(plan.projectId) ?? null : null;
      if (!project || isProjectColorUnassigned(project.color)) continue;
      colors.set(plan.id, project.color);
    }
    return colors;
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

  const eventDatesByPlanId = useMemo(() => {
    const map = new Map<string, ScheduleGridEventDates>();
    for (const plan of selectedPlans) {
      map.set(plan.id, {
        eventStartDate: plan.eventStartDate,
        eventEndDate: plan.eventEndDate,
      });
    }
    return map;
  }, [selectedPlans]);

  const sharedFullEventSpan = useMemo(() => {
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    for (const plan of selectedPlans) {
      const span = getFullEventSpan(plan, plan.eventStartDate, plan.eventEndDate);
      if (span == null) continue;
      if (minStart == null || span.start < minStart) minStart = span.start;
      if (maxEnd == null || span.end > maxEnd) maxEnd = span.end;
    }
    return minStart != null && maxEnd != null ? { start: minStart, end: maxEnd } : null;
  }, [selectedPlans]);

  const displayCalendar = useMemo(() => {
    if (!showFullSpan || sharedFullEventSpan == null) return crewPoolCalendar;
    return generateFullSpanVirtualDays(sharedFullEventSpan, crewPoolCalendar, crewPoolDefaultCrewSize);
  }, [showFullSpan, sharedFullEventSpan, crewPoolCalendar, crewPoolDefaultCrewSize]);

  const handleToggleFullSpan = useCallback(() => setShowFullSpan((prev) => !prev), []);

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

  const handleDefaultCrewSizeChange = useCallback((value: string) => {
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
  }, [crewPoolCalendar, selectedPlans, applyPlanMutation]);

  useEffect(() => {
    onSharedScheduleContextChange?.({
      crewPoolDefaultCrewSize,
      onDefaultCrewSizeChange: handleDefaultCrewSizeChange,
    });
    return () => onSharedScheduleContextChange?.(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewPoolDefaultCrewSize, handleDefaultCrewSizeChange]);

  const handleUpdateCalendarDay = (date: string, updates: Partial<WorkCalendarDay>) => {
    setCrewPoolCalendar((prev) => updateSharedCrewPoolCalendarDay(prev, date, updates));

    // Propagate to each plan so assignment/crew mutations persist (they use plan.workCalendar)
    for (const plan of selectedPlans) {
      if (isPlanArchived(plan)) continue;
      applyPlanMutation(plan.id, (currentPlan) => syncSharedCrewPoolDayToPlan(currentPlan, date, updates));
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
      ? { id: 'global' as const, defaultCrewSize: crewPoolSystemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor, allocations: crewPoolAllocations, dailyDeployments: crewPoolDailyDeployments, updatedAt: '' }
      : undefined;
    const { planUpdatesById, report } = runSharedAutoSchedule({
      plans: mutablePlans,
      calendar: crewPoolCalendar,
      defaultCrewSize: crewPoolDefaultCrewSize,
      tagSequence,
      crewPool,
      workTypes: workTypesById,
    });

    if (report.changed.length === 0) return;

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

  const handleToggleWorkday = useCallback((date: string) => {
    const day = displayCalendar.find((d) => d.date === date);
    if (!day) return;
    handleUpdateCalendarDay(date, { isWorkDay: !day.isWorkDay });
  }, [displayCalendar, handleUpdateCalendarDay]);

  const handleEditDay = useCallback((date: string, anchor: HTMLElement) => {
    setDayEdit((prev) => (prev?.date === date ? null : { date, anchor }));
  }, []);

  return (
    <SharedScheduleWorkspaceSections
      selectedPlans={selectedPlans}
      capacity={capacity}
      crewPoolCalendar={crewPoolCalendar}
      displayCalendar={displayCalendar}
      crewPoolDefaultCrewSize={crewPoolDefaultCrewSize}
      showFullSpan={showFullSpan}
      onToggleFullSpan={sharedFullEventSpan != null ? handleToggleFullSpan : undefined}
      rows={rows}
      phaseDatesByPlanId={phaseDatesByPlanId}
      eventDatesByPlanId={eventDatesByPlanId}
      planDisplayNameByPlanId={planDisplayNameByPlanId}
      projectAccentColorByPlanId={projectAccentColorByPlanId}
      itemByCompositeId={itemByCompositeId}
      onUpdateCalendarDay={handleUpdateCalendarDay}
      onAutoScheduleShared={handleAutoScheduleShared}
      onToggleWorkday={handleToggleWorkday}
      onEditDay={handleEditDay}
      dayEdit={dayEdit}
      onCloseDayEdit={() => setDayEdit(null)}
      onToggleAssignment={handleToggleAssignment}
      onPersonHoursForDateChange={handlePersonHoursForDateChange}
    />
  );
}

function SharedScheduleWorkspaceSections({
  selectedPlans,
  capacity,
  crewPoolCalendar,
  displayCalendar,
  crewPoolDefaultCrewSize,
  showFullSpan,
  onToggleFullSpan,
  rows,
  phaseDatesByPlanId,
  eventDatesByPlanId,
  planDisplayNameByPlanId,
  projectAccentColorByPlanId,
  itemByCompositeId,
  onUpdateCalendarDay,
  onAutoScheduleShared,
  onToggleWorkday,
  onEditDay,
  dayEdit,
  onCloseDayEdit,
  onToggleAssignment,
  onPersonHoursForDateChange,
}: SharedScheduleWorkspaceSectionsProps) {
  return (
    <div className="planning-view schedule-view">
      {selectedPlans.length === 0 ? (
        <section className="schedule-view__block">
          <p className="schedule-view__muted">Select at least one plan to build a shared schedule.</p>
        </section>
      ) : (
        <>
          <ScheduleMetricStrip
            metrics={buildSharedCapacityMetrics(capacity)}
            steps={[]}
            onOpenAssistant={onAutoScheduleShared}
            showFullSpan={showFullSpan}
            onToggleFullSpan={onToggleFullSpan}
          />
          <div className="schedule-view__grid-stack">
            <ScheduleGrid
              mode="shared"
              rows={rows}
              calendar={displayCalendar}
              capacity={capacity}
              phaseDatesByPlanId={phaseDatesByPlanId}
              eventDatesByPlanId={eventDatesByPlanId}
              planDisplayNameByPlanId={planDisplayNameByPlanId}
              projectAccentColorByPlanId={projectAccentColorByPlanId}
              itemByCompositeId={itemByCompositeId}
              onAutoSchedule={onAutoScheduleShared}
              onToggleWorkday={onToggleWorkday}
              onEditDay={onEditDay}
              onToggleAssignment={onToggleAssignment}
              onPersonHoursForDateChange={onPersonHoursForDateChange}
            />
          </div>
          {dayEdit && (() => {
            const editDay = crewPoolCalendar.find((d) => d.date === dayEdit.date);
            if (!editDay) return null;
            return (
              <DayEditPopover
                anchor={dayEdit.anchor}
                day={editDay}
                defaultCrewSize={crewPoolDefaultCrewSize}
                onUpdate={onUpdateCalendarDay}
                onClose={onCloseDayEdit}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}

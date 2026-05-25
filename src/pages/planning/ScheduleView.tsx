import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTagSequenceStore } from '../../lib/stores/tag-sequence-store';
import { useTagStore } from '../../lib/stores/tag-store';
import { useCrewPoolStore } from '../../lib/stores/crew-pool-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { ChevronLeftIcon } from '../../components/icons';
import { ScheduleMetricStrip } from './schedule/ScheduleMetricStrip';
import { buildScheduleCoverageMetric, getScheduleViewMetrics } from './workspace/workspace-metrics';
import { type Plan, type PlanLineItem, activatePlan, revertToDraft, handOffPlan, getPhaseFields, planTotalPersonHours } from '../../lib/planning/plan-model';
import { exportPlanPackage } from '../../lib/interop/data-transfer/plan-package';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { useScheduleAssistantState } from './hooks/useScheduleAssistantState';
import { useScheduleSequenceTagIds } from './hooks/useScheduleSequenceTagIds';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { generateConflictSuggestions } from '../../lib/planning/scheduling/conflict-resolution';
import { toggleAssignmentDate, getAssignedDates } from '../../lib/planning/scheduling/assignment';
import { applyBulkScheduleAmendment, applyScheduleAmendment, type BulkScheduleAmendmentChange } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { BUILD_PHASES, type BuildPhase } from '../../lib/types';
import {
  setPlanDefaultCrewSize,
  setPlanDefaultEfficiency,
  setPlanEventDate,
  setPlanPhaseDate,
  updatePlanCalendarDay,
  updateLineItemAssignment,
  updateLineItemPersonHoursForDate,
  syncPlanWorkCalendarFromCrewPool,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { dayAccessHours, reconcileWorkCalendarForSpans } from '../../lib/planning/scheduling/work-calendar';
import {
  resolveRequiredPersonHoursForPhase,
  runAutoSchedule,
} from '../../lib/planning/scheduling/auto-schedule';
import { ScheduleGrid, getSchedulableUnscheduledPhaseRowCount } from './schedule/ScheduleGrid';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { ScheduleAssistantPanel } from './schedule/ScheduleAssistantPanel';
import { type ScheduleEditContextValue } from './workspace/ScheduleEditContext';
import type {
  ScheduleIssuePanelPayload,
} from './workspace/schedule-issue-panel-types';
import { synthesizeScheduleAssistant } from './workspace/schedule-assistant-synthesis';
import { buildScheduleViewIssues } from './workspace/schedule-view-issues';
import {
  type PhaseDateField,
  getPrimaryScheduleRange,
  getScheduleRangeForWorkCalendar,
  getWorkCalendarPhaseSpans,
  readPhaseDateValues,
} from './schedule/schedule-date-ui';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  showBackButton?: boolean;
  readOnly: boolean;
  onScheduleContextChange?: (ctx: ScheduleEditContextValue | null) => void;
}

interface AmendmentState {
  lineItem: PlanLineItem;
  phase: BuildPhase;
  date: string;
  isAssigning: boolean;
  anchor: HTMLElement;
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  showBackButton = true,
  readOnly,
  onScheduleContextChange,
}: ScheduleViewProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const { tags } = useTagStore();
  const { tagIds: storedSequenceTagIds } = useTagSequenceStore();
  const { allocations: crewPoolAllocations, dailyDeployments: crewPoolDailyDeployments, defaultCrewSize: systemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor } = useCrewPoolStore();
  const effectiveCrewSize = systemDefaultCrewSize ?? currentPlan.defaultCrewSize;
  const { workTypes } = useWorkTypeStore();
  const workTypesById = useMemo(() => new Map(workTypes.map((wt) => [wt.id, wt])), [workTypes]);
  const crewPool = useMemo(
    () => (Object.keys(crewPoolAllocations).length > 0 || systemDefaultCrewSize != null)
      ? { id: 'global' as const, defaultCrewSize: systemDefaultCrewSize, taskSwitchingFactor: crewPoolTaskSwitchingFactor, allocations: crewPoolAllocations, dailyDeployments: crewPoolDailyDeployments, updatedAt: '' }
      : undefined,
    [crewPoolAllocations, crewPoolDailyDeployments, systemDefaultCrewSize, crewPoolTaskSwitchingFactor],
  );

  // Build the full execution sequence: explicitly-ordered tags first, then any
  // sequencable tags not yet saved to the sequence (alphabetical). This mirrors
  // SettingsTagSequenceView so the assistant always respects all sequencable tags
  // even when the user hasn't visited the sequence settings view yet.
  const sequenceTagIds = useScheduleSequenceTagIds(tags, storedSequenceTagIds);
  const [amendment, setAmendment] = useState<AmendmentState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(false);
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const phaseDates = useMemo(() => readPhaseDateValues(currentPlan), [currentPlan]);
  const primaryRange = useMemo(
    () => getPrimaryScheduleRange(phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate),
    [phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate],
  );
  const workCalendarRange = useMemo(
    () => getScheduleRangeForWorkCalendar(phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate),
    [phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate],
  );
  const workCalendarPhaseSpans = useMemo(
    () => getWorkCalendarPhaseSpans(phaseDates),
    [
      phaseDates.assemblyStartDate,
      phaseDates.assemblyEndDate,
      phaseDates.dismantleStartDate,
      phaseDates.dismantleEndDate,
    ],
  );

  useEffect(() => {
    trackTelemetryEvent('schedule_tab_open');
  }, [plan.id]);

  // Derive work calendar when at least one phase has dates but workCalendar is empty.
  // Assembly and dismantle are resolved independently (event dates are ignored).
  useEffect(() => {
    if (workCalendarPhaseSpans.length > 0 && currentPlan.workCalendar.length === 0) {
      mutatePlan((prev) => ({
        ...prev,
        workCalendar: reconcileWorkCalendarForSpans(
          prev.workCalendar,
          workCalendarPhaseSpans,
          systemDefaultCrewSize ?? prev.defaultCrewSize,
        ),
      }));
    }
  }, [
    workCalendarPhaseSpans,
    currentPlan.workCalendar.length,
    mutatePlan,
  ]);

  const capacity = useMemo(
    () => computeCapacitySummary(currentPlan, effectiveCrewSize, crewPool, workTypesById),
    [currentPlan, effectiveCrewSize, crewPool, workTypesById],
  );
  const scheduleCoverage = useMemo(
    () => buildScheduleCoverageMetric(
      planTotalPersonHours(currentPlan),
      capacity.totalRequiredPersonHours,
    ),
    [capacity.totalRequiredPersonHours, currentPlan.lineItems],
  );
  const scheduleKpiMetrics = useMemo(
    () => getScheduleViewMetrics(currentPlan, { capacity, coverage: scheduleCoverage }),
    [capacity, currentPlan, scheduleCoverage],
  );
  const conflictSuggestions = useMemo(
    () => generateConflictSuggestions(capacity),
    [capacity],
  );
  const workDays = useMemo(
    () => currentPlan.workCalendar.filter((day) => day.isWorkDay),
    [currentPlan.workCalendar],
  );
  const schedulableUnscheduledCount = useMemo(
    () => getSchedulableUnscheduledPhaseRowCount(currentPlan.lineItems, phaseDates, workDays),
    [currentPlan.lineItems, phaseDates, workDays],
  );
  const scheduledPhaseRowCount = useMemo(() => {
    let count = 0;
    for (const item of currentPlan.lineItems) {
      for (const phase of BUILD_PHASES) {
        const pf = getPhaseFields(item, phase);
        if (getAssignedDates(pf).length > 0) count += 1;
      }
    }
    return count;
  }, [currentPlan.lineItems]);

  const {
    assistantReportStale,
    assistantUnresolvedCount,
    assistantReviewIssues,
    activeAssistantIssue,
    unresolvedIssueKeys,
    markAssistantFindingsStale,
    applyAssistantRunReport,
    focusNextReviewIssue,
    focusPrevReviewIssue,
    focusReviewIssueByKey,
  } = useScheduleAssistantState({
    planId: plan.id,
    lineItems: currentPlan.lineItems,
  });

  const clearAssistantReport = useCallback(() => {
    markAssistantFindingsStale();
  }, [markAssistantFindingsStale]);

  const handlePlanDateChange = useCallback((
    field: 'eventStartDate' | 'eventEndDate',
    value: string,
  ) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanEventDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const handlePlanPhaseDateChange = useCallback((
    field: PhaseDateField,
    value: string,
  ) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanPhaseDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const handleDefaultCrewChange = useCallback((value: string) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const handleDefaultEfficiencyChange = useCallback((value: string) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanDefaultEfficiency(prev, value));
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const handleUpdateCalendarDay = useCallback((date: string, updates: Partial<Plan['workCalendar'][number]>) => {
    clearAssistantReport();
    mutatePlan((prev) => updatePlanCalendarDay(prev, date, updates));
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const handleToggleWorkday = useCallback((date: string) => {
    clearAssistantReport();
    mutatePlan((prev) => {
      const existing = prev.workCalendar.find((d) => d.date === date);
      if (existing) {
        return updatePlanCalendarDay(prev, date, { isWorkDay: !existing.isWorkDay });
      }
      return syncPlanWorkCalendarFromCrewPool(prev, date, { isWorkDay: true });
    });
    trackTelemetryEvent('schedule_calendar_edit');
  }, [clearAssistantReport, mutatePlan]);

  const todayIso = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const handleToggleAssignment = (lineItem: PlanLineItem, phase: BuildPhase, date: string, cellElement?: HTMLElement) => {
    if (currentPlan.status === 'active' && cellElement) {
      const pf = getPhaseFields(lineItem, phase);
      const assignedDates = getAssignedDates(pf);
      const isAssigning = !assignedDates.includes(date);
      setAmendment({ lineItem, phase, date, isAssigning, anchor: cellElement });
      return;
    }
    applyToggle(lineItem, phase, date, null);
  };

  const applyToggle = (lineItem: PlanLineItem, phase: BuildPhase, date: string, amendmentNote: string | null) => {
    clearAssistantReport();
    mutatePlan((prev) => {
      const currentLineItem = prev.lineItems.find((item) => item.id === lineItem.id);
      if (!currentLineItem) return prev;
      const pf = getPhaseFields(currentLineItem, phase);
      const day = prev.workCalendar.find((candidate) => candidate.date === date);
      if (day && !day.isWorkDay) return prev;
      const accessHours = day ? dayAccessHours(day) : 8;
      const requiredPH = resolveRequiredPersonHoursForPhase(currentLineItem, phase) ?? 0;
      const alreadyScheduledPH = Object.values(pf.personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0);
      const preferredDayPH = accessHours * Math.max(pf.crew, 1);
      const remainingPH = Math.max(requiredPH - alreadyScheduledPH, 0);
      const defaultPersonHours = Math.max(
        Math.min(remainingPH || preferredDayPH, preferredDayPH),
        0.01,
      );
      const result = toggleAssignmentDate({ personHoursByDate: pf.personHoursByDate }, date, defaultPersonHours);
      if (prev.status === 'active') {
        return applyScheduleAmendment(
          prev,
          currentLineItem,
          phase,
          result.span.scheduledStart,
          result.span.scheduledEnd,
          amendmentNote,
          result.personHoursByDate,
        );
      }
      return updateLineItemAssignment(prev, currentLineItem.id, phase, result.span, result.personHoursByDate);
    });
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handlePersonHoursForDateChange = (
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    personHours: number,
  ) => {
    let amendmentNote: string | null = null;
    if (currentPlan.status === 'active') {
      const note = window.prompt('Planned-hours amendment note (required):', '');
      if (note == null) return;
      if (note.trim().length === 0) {
        window.alert('Amendment note is required when editing planned hours on active plans.');
        return;
      }
      amendmentNote = note.trim();
    }

    clearAssistantReport();
    mutatePlan((prev) => {
      const currentLineItem = prev.lineItems.find((item) => item.id === lineItemId);
      if (!currentLineItem) return prev;

      const nextPlan = updateLineItemPersonHoursForDate(prev, currentLineItem.id, phase, date, personHours);
      if (nextPlan === prev) return prev;

      if (prev.status === 'active') {
        const nextLineItem = nextPlan.lineItems.find((item) => item.id === currentLineItem.id) ?? currentLineItem;
        const nextPf = getPhaseFields(nextLineItem, phase);
        return applyScheduleAmendment(
          prev,
          currentLineItem,
          phase,
          nextPf.scheduledStart,
          nextPf.scheduledEnd,
          amendmentNote,
          nextPf.personHoursByDate,
        );
      }

      return nextPlan;
    });
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handleClearRowSchedule = (lineItem: PlanLineItem, phase: BuildPhase) => {
    let amendmentNote: string | null = null;
    if (currentPlan.status === 'active') {
      const note = window.prompt('Schedule clear amendment note (required):', '');
      if (note == null) return;
      if (note.trim().length === 0) {
        window.alert('Amendment note is required when clearing schedule rows on active plans.');
        return;
      }
      amendmentNote = note;
    }

    clearAssistantReport();
    mutatePlan((prev) => {
      const currentLineItem = prev.lineItems.find((item) => item.id === lineItem.id);
      if (!currentLineItem) return prev;

      const pf = getPhaseFields(currentLineItem, phase);
      if (getAssignedDates(pf).length === 0) return prev;

      if (prev.status === 'active') {
        return applyScheduleAmendment(prev, currentLineItem, phase, null, null, amendmentNote);
      }

      return updateLineItemAssignment(
        prev,
        currentLineItem.id,
        phase,
        { scheduledStart: null, scheduledEnd: null },
        undefined,
      );
    });
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handleClearAllSchedules = useCallback(() => {
    if (scheduledPhaseRowCount === 0) return;
    const confirmed = window.confirm(
      `Clear schedule assignments for ${scheduledPhaseRowCount} ${scheduledPhaseRowCount === 1 ? 'row' : 'rows'}?`,
    );
    if (!confirmed) return;

    let amendmentNote: string | null = null;
    if (currentPlan.status === 'active') {
      const note = window.prompt('Schedule clear-all amendment note (required):', '');
      if (note == null) return;
      if (note.trim().length === 0) {
        window.alert('Amendment note is required when clearing all schedule rows on active plans.');
        return;
      }
      amendmentNote = note;
    }

    clearAssistantReport();
    mutatePlan((prev) => {
      let nextPlan = prev;
      const changes: BulkScheduleAmendmentChange[] = [];

      for (const item of prev.lineItems) {
        for (const phase of BUILD_PHASES) {
          const pf = getPhaseFields(item, phase);
          if (getAssignedDates(pf).length === 0) continue;
          nextPlan = updateLineItemAssignment(
            nextPlan,
            item.id,
            phase,
            { scheduledStart: null, scheduledEnd: null },
            undefined,
          );
          changes.push({
            lineItemId: item.id,
            phase,
            scheduledStart: null,
            scheduledEnd: null,
          });
        }
      }

      if (changes.length === 0) return prev;
      if (prev.status === 'active') {
        return applyBulkScheduleAmendment(prev, nextPlan, changes, amendmentNote ?? '');
      }
      return nextPlan;
    });
    trackTelemetryEvent('schedule_assignment_edit');
  }, [clearAssistantReport, currentPlan.status, mutatePlan, scheduledPhaseRowCount]);

  const handleAmendmentConfirm = (note: string | null) => {
    if (amendment) {
      applyToggle(amendment.lineItem, amendment.phase, amendment.date, note);
      setAmendment(null);
    }
  };

  const handleAmendmentCancel = () => {
    setAmendment(null);
  };

  const handleAutoSchedule = useCallback(() => {
    const rerunFromStale = assistantReportStale;
    const tagSequence = sequenceTagIds.length > 0
      ? { id: 'global' as const, tagIds: sequenceTagIds, updatedAt: '' }
      : undefined;
    const { plan: scheduledPlan, report } = runAutoSchedule(
      currentPlan,
      {
        ...(rerunFromStale ? { includeScheduled: true } : {}),
        tagSequence,
        crewPool,
        workTypes: workTypesById,
      },
    );

    let nextPlan = scheduledPlan;
    if (currentPlan.status === 'active' && report.changed.length > 0) {
      const note = window.prompt('Assistant run amendment note (required):', '');
      if (note == null) return;
      if (note.trim().length === 0) {
        window.alert('Amendment note is required for assistant runs on active plans.');
        return;
      }
      const changes: BulkScheduleAmendmentChange[] = report.changed.map((row) => ({
        lineItemId: row.lineItemId,
        phase: row.phase,
        scheduledStart: row.scheduledStart,
        scheduledEnd: row.scheduledEnd,
      }));
      nextPlan = applyBulkScheduleAmendment(currentPlan, scheduledPlan, changes, note);
    }

    mutatePlan(() => nextPlan);
    applyAssistantRunReport(report);
    trackTelemetryEvent('schedule_assignment_edit');
    trackTelemetryEvent('schedule_assistant_run', {
      changed_count: report.changed.length,
      unresolved_count: report.unresolved.length,
      include_scheduled: rerunFromStale,
      coverage_ratio_before: report.before.coverageRatio,
      coverage_ratio_after: report.after.coverageRatio,
      over_capacity_days_before: report.before.overCapacityDays,
      over_capacity_days_after: report.after.overCapacityDays,
    });
  }, [assistantReportStale, applyAssistantRunReport, crewPoolAllocations, currentPlan, mutatePlan, sequenceTagIds, workTypesById]);

  const isLocked = currentPlan.status === 'active';

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await flushAndWait();
      await exportPlanPackage(currentPlan);
      mutatePlan((prev) => handOffPlan(prev));
      trackTelemetryEvent('interop_plan_package_export');
    } catch {
      window.alert('Could not export plan. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleActivate = () => {
    if (currentPlan.projectId == null && currentPlan.title.trim().length === 0) {
      window.alert('Add an event or project name before activating this plan.');
      return;
    }
    mutatePlan((prev) => activatePlan(prev));
    trackTelemetryEvent('planning_lock_toggle');
  };

  const handleRevertToDraft = () => {
    mutatePlan((prev) => revertToDraft(prev));
    trackTelemetryEvent('planning_lock_toggle');
  };

  const handleOpenWorkCalendar = useCallback(() => {
    // Work calendar is now in the sidebar drill-in — no-op for now
  }, []);

  const handleOpenScheduleGrid = useCallback(() => {
    const el = scheduleGridRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleScrollToDate = useCallback((date: string) => {
    const cell = scheduleGridRef.current?.querySelector(`[data-date="${date}"]`);
    cell?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  const handlePrevAssistantIssue = useCallback(() => {
    if (!focusPrevReviewIssue()) return;
    handleOpenScheduleGrid();
  }, [focusPrevReviewIssue, handleOpenScheduleGrid]);

  const handleNextAssistantIssue = useCallback(() => {
    if (!focusNextReviewIssue()) return;
    handleOpenScheduleGrid();
  }, [focusNextReviewIssue, handleOpenScheduleGrid]);

  const handleSelectAssistantIssue = useCallback((issueKey: string) => {
    if (!focusReviewIssueByKey(issueKey)) return;
    handleOpenScheduleGrid();
  }, [focusReviewIssueByKey, handleOpenScheduleGrid]);

  const { planningIssues, panelIssues } = useMemo(() => buildScheduleViewIssues({
    capacity,
    conflictSuggestions,
    schedulableUnscheduledCount,
    assistantReportStale,
    assistantUnresolvedCount,
    assistantReviewIssues,
  }), [
    capacity,
    conflictSuggestions,
    schedulableUnscheduledCount,
    assistantReportStale,
    assistantReviewIssues,
    assistantUnresolvedCount,
  ]);

  const assistantSynthesis = useMemo(
    () => synthesizeScheduleAssistant({
      isStale: assistantReportStale,
      unresolvedCount: assistantUnresolvedCount,
      issues: panelIssues,
      canRunAssistant: !readOnly,
    }),
    [assistantReportStale, assistantUnresolvedCount, panelIssues, readOnly],
  );

  const runAssistantFromPanel = useCallback(async () => {
    handleAutoSchedule();
  }, [handleAutoSchedule]);

  const issuePanelPayload = useMemo<ScheduleIssuePanelPayload>(() => ({
    state: {
      planId: plan.id,
      isStale: assistantReportStale,
      unresolvedCount: assistantUnresolvedCount,
      issues: panelIssues,
      assistantStatus: assistantSynthesis.assistantStatus,
      assistantSummary: assistantSynthesis.assistantSummary,
      assistantBestNextMove: assistantSynthesis.assistantBestNextMove,
      assistantInsights: assistantSynthesis.assistantInsights,
      activeIssueKey: activeAssistantIssue?.key ?? null,
      canRunAssistant: !readOnly,
      canClearAll: !readOnly && scheduledPhaseRowCount > 0,
    },
    actions: {
      selectIssue: handleSelectAssistantIssue,
      focusNext: handleNextAssistantIssue,
      focusPrev: handlePrevAssistantIssue,
      runAssistant: runAssistantFromPanel,
      clearAllSchedules: handleClearAllSchedules,
      openCalendar: handleOpenWorkCalendar,
    },
  }), [
    plan.id,
    assistantReportStale,
    assistantUnresolvedCount,
    panelIssues,
    assistantSynthesis,
    activeAssistantIssue,
    readOnly,
    scheduledPhaseRowCount,
    handleSelectAssistantIssue,
    handleNextAssistantIssue,
    handlePrevAssistantIssue,
    runAssistantFromPanel,
    handleClearAllSchedules,
    handleOpenWorkCalendar,
  ]);

  const criticalIssueCount = planningIssues.filter((issue) => issue.severity === 'critical').length;
  const warningIssueCount = planningIssues.filter((issue) => issue.severity === 'warning').length;

  const scheduleBlockReason = criticalIssueCount > 0
    ? `${criticalIssueCount} critical issue${criticalIssueCount === 1 ? '' : 's'} must be resolved first`
    : schedulableUnscheduledCount > 0
      ? `${schedulableUnscheduledCount} assignment${schedulableUnscheduledCount === 1 ? '' : 's'} not yet scheduled`
      : null;

  const scheduleSteps = [
    {
      id: 'plan',
      label: 'Plan',
      complete: currentPlan.lineItems.length > 0,
      isCta: false,
    },
    {
      id: 'crew',
      label: 'Crew',
      complete: currentPlan.workCalendar.length > 0 && effectiveCrewSize != null,
      isCta: false,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      complete: isLocked,
      isCta: !readOnly && !isLocked,
      onClick: handleActivate,
      disabled: scheduleBlockReason != null,
      disabledReason: scheduleBlockReason,
    },
    {
      id: 'hand-off',
      label: 'Hand off',
      complete: currentPlan.handedOffAt != null,
      isCta: !readOnly && isLocked,
      persistCta: true,
      onClick: handleExport,
      disabled: isExporting,
      disabledReason: isExporting ? 'Exporting…' : null,
    },
  ];

  const contextValue = useMemo(() => ({
    currentPlan,
    phaseDates,
    primaryRange,
    workCalendarRange,
    effectiveCrewSize: effectiveCrewSize ?? null,
    totalAvailable: capacity.totalEffectiveAvailablePersonHours,
    readOnly,
    onPhaseDateChange: handlePlanPhaseDateChange,
    onEventDateChange: handlePlanDateChange,
    onDefaultCrewChange: handleDefaultCrewChange,
    onDefaultEfficiencyChange: handleDefaultEfficiencyChange,
    onUpdateCalendarDay: handleUpdateCalendarDay,
    onScrollToDate: handleScrollToDate,
  }), [
    currentPlan, phaseDates, primaryRange, workCalendarRange,
    effectiveCrewSize, capacity.totalEffectiveAvailablePersonHours, readOnly,
    handlePlanPhaseDateChange, handlePlanDateChange, handleDefaultCrewChange,
    handleDefaultEfficiencyChange, handleUpdateCalendarDay, handleScrollToDate,
  ]);

  useEffect(() => {
    onScheduleContextChange?.(contextValue);
    return () => { onScheduleContextChange?.(null); };
  }, [contextValue, onScheduleContextChange]);

  return (
    <div className="planning-view schedule-view">
      <ScheduleMetricStrip metrics={scheduleKpiMetrics} steps={scheduleSteps} readOnly={readOnly} />
      <div className="schedule-toolbar" role="region" aria-label="Schedule health and controls">
        {showBackButton && (
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Back
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleAutoSchedule}
          disabled={readOnly || schedulableUnscheduledCount === 0}
          aria-label={schedulableUnscheduledCount > 0 ? `Auto-schedule ${schedulableUnscheduledCount} schedulable item${schedulableUnscheduledCount === 1 ? '' : 's'}` : 'No schedulable items — set phase dates, add crew and time'}
          title={schedulableUnscheduledCount > 0 ? `Auto-schedule ${schedulableUnscheduledCount} item${schedulableUnscheduledCount === 1 ? '' : 's'} with crew, time, and phase work days` : 'Set phase dates and add crew/time to items to enable'}
        >
          Auto-schedule ({schedulableUnscheduledCount})
        </button>
        {!readOnly && isLocked && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleRevertToDraft}
          >
            Revert to Draft
          </button>
        )}
        <div className="schedule-toolbar__chips" role="status" aria-live="polite">
          {criticalIssueCount > 0 && (
            <span className="schedule-view__planning-chip schedule-view__planning-chip--critical">
              {criticalIssueCount} {criticalIssueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {warningIssueCount > 0 && (
            <span className="schedule-view__planning-chip schedule-view__planning-chip--warning">
              {warningIssueCount} {warningIssueCount === 1 ? 'warning' : 'warnings'}
            </span>
          )}
          <button
            type="button"
            className={`btn btn--secondary btn--sm${planningIssues.length > 0 ? ' schedule-view__assistant-btn--has-issues' : ''}`}
            onClick={() => setIsAssistantPanelOpen(true)}
            aria-haspopup="dialog"
          >
            Schedule Assistant
            {planningIssues.length > 0 && (
              <span className="schedule-view__assistant-btn-count">{planningIssues.length}</span>
            )}
          </button>
        </div>
      </div>

      <div ref={scheduleGridRef} className="schedule-view__grid-stack">
        <ScheduleGrid
          lineItems={currentPlan.lineItems}
          calendar={currentPlan.workCalendar}
          capacity={capacity}
          phaseDates={phaseDates}
          readOnly={readOnly}
          onToggleAssignment={handleToggleAssignment}
          onClearRowSchedule={handleClearRowSchedule}
          onPersonHoursForDateChange={handlePersonHoursForDateChange}
          unresolvedIssueKeys={unresolvedIssueKeys}
          activeIssueKey={activeAssistantIssue?.key ?? null}
          onToggleWorkday={readOnly ? undefined : handleToggleWorkday}
          todayIso={todayIso}
          eventStartDate={currentPlan.eventStartDate}
          eventEndDate={currentPlan.eventEndDate}
        />
      </div>

      {amendment && (
        <AmendmentPopover
          anchor={amendment.anchor}
          lineItemTitle={amendment.lineItem.title}
          date={amendment.date}
          isAssigning={amendment.isAssigning}
          onConfirm={handleAmendmentConfirm}
          onCancel={handleAmendmentCancel}
        />
      )}

      <ScheduleAssistantPanel
        payload={issuePanelPayload}
        isOpen={isAssistantPanelOpen}
        onClose={() => setIsAssistantPanelOpen(false)}
      />
    </div>
  );
}

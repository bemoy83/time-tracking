import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import { type Plan, type PlanLineItem, activatePlan, revertToDraft, getPhaseFields } from '../../lib/planning/plan-model';
import { exportPlanPackage } from '../../lib/interop/data-transfer/plan-package';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { useScheduleAssistantState } from './hooks/useScheduleAssistantState';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { toggleAssignmentDate, getAssignedDates } from '../../lib/planning/scheduling/assignment';
import { lazyMigrateCrewByDate } from '../../lib/planning/scheduling/plan-schedule-update';
import { applyBulkScheduleAmendment, applyScheduleAmendment, type BulkScheduleAmendmentChange } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { BUILD_PHASES, type BuildPhase } from '../../lib/types';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  setPlanPhaseDate,
  updatePlanCalendarDay,
  updateLineItemAssignment,
  updateLineItemCrewForDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { reconcileWorkCalendarForSpans } from '../../lib/planning/scheduling/work-calendar';
import {
  runAutoSchedule,
  type AutoScheduleUnresolvedReason,
} from '../../lib/planning/scheduling/auto-schedule';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { ScheduleGrid, getSchedulableUnscheduledPhaseRowCount } from './schedule/ScheduleGrid';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { PlanScheduleInputsPanel } from './schedule/PlanScheduleInputsPanel';
import type {
  ScheduleIssueItem,
  ScheduleIssuePanelPayload,
} from './workspace/schedule-issue-panel-types';
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
  isWorkspaceMode?: boolean;
  onIssuePanelChange?: (payload: ScheduleIssuePanelPayload | null) => void;
}

interface AmendmentState {
  lineItem: PlanLineItem;
  phase: BuildPhase;
  date: string;
  isAssigning: boolean;
  anchor: HTMLElement;
}

type PlanningIssueSeverity = 'critical' | 'warning' | 'info';

interface PlanningIssue {
  id: string;
  severity: PlanningIssueSeverity;
  label: string;
}

interface RecommendationCta {
  id: 'calendar' | 'grid' | 'assistant';
  label: string;
  onClick: () => void;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function unresolvedReasonLabel(reason: AutoScheduleUnresolvedReason): string {
  switch (reason) {
    case 'missing_required_hours':
      return 'Missing required hours';
    case 'no_work_days':
      return 'No work days';
    case 'no_capacity_window':
      return 'No capacity window';
    default:
      return 'Unresolved';
  }
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  showBackButton = true,
  readOnly,
  isWorkspaceMode = false,
  onIssuePanelChange,
}: ScheduleViewProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const [amendment, setAmendment] = useState<AmendmentState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const workCalendarRef = useRef<HTMLDivElement>(null);
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const phaseDates = readPhaseDateValues(currentPlan);
  const primaryRange = getPrimaryScheduleRange(
    phaseDates,
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
  );
  const workCalendarRange = getScheduleRangeForWorkCalendar(
    phaseDates,
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
  );
  const workCalendarPhaseSpans = useMemo(
    () => getWorkCalendarPhaseSpans(phaseDates),
    [
      phaseDates.buildUpStartDate,
      phaseDates.buildUpEndDate,
      phaseDates.tearDownStartDate,
      phaseDates.tearDownEndDate,
    ],
  );

  useEffect(() => {
    trackTelemetryEvent('schedule_tab_open');
  }, [plan.id]);

  // Derive work calendar when at least one phase has dates but workCalendar is empty.
  // Build-up and tear-down are resolved independently (event dates are ignored).
  useEffect(() => {
    if (workCalendarPhaseSpans.length > 0 && currentPlan.workCalendar.length === 0) {
      mutatePlan((prev) => ({
        ...prev,
        workCalendar: reconcileWorkCalendarForSpans(
          prev.workCalendar,
          workCalendarPhaseSpans,
          prev.defaultCrewSize,
        ),
      }));
    }
  }, [
    workCalendarPhaseSpans,
    currentPlan.workCalendar.length,
    mutatePlan,
  ]);

  const capacity = useMemo(
    () => computeCapacitySummary(currentPlan),
    [currentPlan],
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
        if (pf.scheduledStart != null || pf.scheduledEnd != null) count += 1;
      }
    }
    return count;
  }, [currentPlan.lineItems]);

  const {
    assistantReport,
    assistantReportStale,
    assistantUnresolvedCount,
    assistantReviewIssues,
    activeAssistantIssue,
    activeAssistantIssueIndex,
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

  const handlePlanDateChange = (
    field: 'eventStartDate' | 'eventEndDate',
    value: string,
  ) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanEventDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handlePlanPhaseDateChange = (
    field: PhaseDateField,
    value: string,
  ) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanPhaseDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleDefaultCrewChange = (value: string) => {
    clearAssistantReport();
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<Plan['workCalendar'][number]>) => {
    clearAssistantReport();
    mutatePlan((prev) => updatePlanCalendarDay(prev, date, updates));
    trackTelemetryEvent('schedule_calendar_edit');
  };

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
      const migrated = lazyMigrateCrewByDate(pf, prev.workCalendar);
      const result = toggleAssignmentDate({ ...pf, crewByDate: migrated }, date);
      if (prev.status === 'active') {
        return applyScheduleAmendment(
          prev,
          currentLineItem,
          phase,
          result.span.scheduledStart,
          result.span.scheduledEnd,
          amendmentNote,
          result.crewByDate,
        );
      }
      return updateLineItemAssignment(prev, currentLineItem.id, phase, result.span, result.crewByDate);
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
      if (pf.scheduledStart == null && pf.scheduledEnd == null) return prev;

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
          if (pf.scheduledStart == null && pf.scheduledEnd == null) continue;
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
    const { plan: scheduledPlan, report } = runAutoSchedule(
      currentPlan,
      rerunFromStale ? { includeScheduled: true } : undefined,
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
  }, [assistantReportStale, applyAssistantRunReport, currentPlan, mutatePlan]);

  const handleCrewForDateChange = (lineItemId: string, phase: BuildPhase, date: string, crew: number) => {
    clearAssistantReport();
    mutatePlan((prev) => updateLineItemCrewForDate(prev, lineItemId, phase, date, crew));
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const isLocked = currentPlan.status === 'active';

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await flushAndWait();
      await exportPlanPackage(currentPlan);
      trackTelemetryEvent('interop_plan_package_export');
    } catch {
      window.alert('Could not export plan. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleLock = () => {
    mutatePlan((prev) => (isLocked ? revertToDraft(prev) : activatePlan(prev)));
    trackTelemetryEvent('planning_lock_toggle');
  };

  const handleOpenWorkCalendar = useCallback(() => {
    const el = workCalendarRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleOpenScheduleGrid = useCallback(() => {
    const el = scheduleGridRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleReviewAssistantIssues = () => {
    if (!focusNextReviewIssue()) {
      handleOpenScheduleGrid();
      return;
    }
    handleOpenScheduleGrid();
  };

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

  const planningIssues: PlanningIssue[] = [];
  if (capacity.overWorkerCapacityDayCount > 0) {
    planningIssues.push({
      id: 'worker-capacity',
      severity: 'critical',
      label: `${capacity.overWorkerCapacityDayCount} ${capacity.overWorkerCapacityDayCount === 1 ? 'day has' : 'days have'} too much work for available crew`,
    });
  }
  if (capacity.overAllocatedDayCount > 0) {
    planningIssues.push({
      id: 'over-allocated',
      severity: 'critical',
      label: `${capacity.overAllocatedDayCount} ${capacity.overAllocatedDayCount === 1 ? 'day is' : 'days are'} overloaded`,
    });
  }
  if (schedulableUnscheduledCount > 0) {
    planningIssues.push({
      id: 'unscheduled',
      severity: 'warning',
      label: `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'assignment' : 'assignments'} not yet scheduled`,
    });
  }
  if (assistantReportStale) {
    planningIssues.push({
      id: 'assistant-stale',
      severity: 'warning',
      label: 'Schedule changed — re-run to re-check',
    });
  }
  if (assistantUnresolvedCount > 0) {
    const unresolvedCount = assistantUnresolvedCount;
    planningIssues.push({
      id: 'assistant-unresolved',
      severity: 'warning',
      label: `${unresolvedCount} ${unresolvedCount === 1 ? 'item' : 'items'} still ${unresolvedCount === 1 ? 'needs' : 'need'} review`,
    });
  }
  if (capacity.overStaffedDayCount > 0) {
    planningIssues.push({
      id: 'over-staffed',
      severity: 'info',
      label: `${capacity.overStaffedDayCount} ${capacity.overStaffedDayCount === 1 ? 'day' : 'days'} may be overstaffed`,
    });
  }

  const panelIssues = useMemo<ScheduleIssueItem[]>(() => {
    const issues: ScheduleIssueItem[] = [];

    if (capacity.overWorkerCapacityDayCount > 0) {
      issues.push({
        id: 'worker-capacity',
        kind: 'capacity',
        severity: 'critical',
        label: `${capacity.overWorkerCapacityDayCount} ${capacity.overWorkerCapacityDayCount === 1 ? 'day has' : 'days have'} too much work for available crew`,
      });
    }

    if (capacity.overAllocatedDayCount > 0) {
      issues.push({
        id: 'over-allocated',
        kind: 'capacity',
        severity: 'critical',
        label: `${capacity.overAllocatedDayCount} ${capacity.overAllocatedDayCount === 1 ? 'day is' : 'days are'} overloaded`,
      });
    }

    if (schedulableUnscheduledCount > 0) {
      issues.push({
        id: 'unscheduled',
        kind: 'unscheduled',
        severity: 'warning',
        label: `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'assignment' : 'assignments'} not yet scheduled`,
      });
    }

    if (assistantReportStale) {
      issues.push({
        id: 'assistant-stale',
        kind: 'assistant-stale',
        severity: 'warning',
        label: 'Schedule changed — re-run to re-check',
      });
    }

    if (!assistantReportStale) {
      for (const issue of assistantReviewIssues) {
        issues.push({
          id: `assistant-unresolved-${issue.key}`,
          kind: 'assistant-unresolved',
          severity: 'warning',
          label: `${issue.lineItemTitle} · ${issue.phase} · ${unresolvedReasonLabel(issue.reason)}`,
          lineItemId: issue.lineItemId,
          phase: issue.phase,
          issueKey: issue.key,
          unresolvedReason: issue.reason,
          requiredPH: issue.requiredPH,
          assignedPH: issue.assignedPH,
        });
      }
    }

    return issues;
  }, [
    assistantReportStale,
    assistantReviewIssues,
    capacity.overAllocatedDayCount,
    capacity.overWorkerCapacityDayCount,
    schedulableUnscheduledCount,
  ]);

  const runAssistantFromPanel = useCallback(async () => {
    handleAutoSchedule();
  }, [handleAutoSchedule]);

  const issuePanelPayload = useMemo<ScheduleIssuePanelPayload>(() => ({
    state: {
      planId: plan.id,
      isStale: assistantReportStale,
      unresolvedCount: assistantUnresolvedCount,
      issues: panelIssues,
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

  useEffect(() => {
    if (onIssuePanelChange == null) return;
    if (!isWorkspaceMode) {
      onIssuePanelChange(null);
      return;
    }
    onIssuePanelChange(issuePanelPayload);
  }, [isWorkspaceMode, issuePanelPayload, onIssuePanelChange]);

  useEffect(() => () => {
    onIssuePanelChange?.(null);
  }, [onIssuePanelChange]);

  const recommendationText = (() => {
    if (readOnly) return 'Read-only plan. Review issue queue and hand off when ready.';
    if (capacity.overWorkerCapacityDayCount > 0 || capacity.overAllocatedDayCount > 0) {
      return 'Critical conflicts on some days — fix crew or calendar before continuing.';
    }
    if (assistantReportStale) {
      return 'You changed the schedule. Re-run the assistant to re-check before activating.';
    }
    if (assistantUnresolvedCount > 0) {
      return 'Some items still need review — check the grid and finalize assignments.';
    }
    if (schedulableUnscheduledCount > 0) {
      return 'Some work isn\'t scheduled yet — run the assistant or add assignments manually.';
    }
    if (!isLocked) return 'Nothing blocking — you can activate when ready.';
    return 'Plan is active. Keep assignments aligned with live execution changes.';
  })();

  const recommendationCta: RecommendationCta | null = (() => {
    if (readOnly) return null;
    if (capacity.overWorkerCapacityDayCount > 0 || capacity.overAllocatedDayCount > 0) {
      return { id: 'calendar', label: 'Review calendar fixes', onClick: handleOpenWorkCalendar };
    }
    if (assistantReportStale) {
      return { id: 'assistant', label: 'Re-run assistant', onClick: handleAutoSchedule };
    }
    if (assistantUnresolvedCount > 0) {
      return { id: 'grid', label: 'Review issues', onClick: handleReviewAssistantIssues };
    }
    if (schedulableUnscheduledCount > 0) {
      return { id: 'assistant', label: 'Run assistant', onClick: handleAutoSchedule };
    }
    return null;
  })();

  const criticalIssueCount = planningIssues.filter((issue) => issue.severity === 'critical').length;
  const warningIssueCount = planningIssues.filter((issue) => issue.severity === 'warning').length;

  return (
    <div className="planning-view schedule-view">
      <div className="schedule-view__top-band">
        <section className="schedule-view__block schedule-view__top-band-health" aria-label="Schedule health and controls">
          <header className="schedule-view__top-band-header">
            <div className="schedule-view__top-band-title-row">
              {showBackButton && (
                <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
                  <ChevronLeftIcon className="planning-view__back-icon" />
                  Back
                </button>
              )}
              <h2 className="planning-view__title" style={{ flex: 1 }}>
                Schedule
              </h2>
              <div className="schedule-view__planning-meta" role="status" aria-live="polite">
                <span className="schedule-view__planning-chip">
                  {planningIssues.length} {planningIssues.length === 1 ? 'issue' : 'issues'}
                </span>
                {criticalIssueCount > 0 && (
                  <span className="schedule-view__planning-chip schedule-view__planning-chip--critical">
                    {criticalIssueCount} critical
                  </span>
                )}
                {warningIssueCount > 0 && (
                  <span className="schedule-view__planning-chip schedule-view__planning-chip--warning">
                    {warningIssueCount} warning
                  </span>
                )}
              </div>
            </div>
          </header>

          <div className="schedule-view__planning-layout">
            <section className="schedule-view__planning-section" aria-label="Things to check">
              <h3 className="schedule-view__planning-title">Things to check</h3>
              {planningIssues.length === 0 ? (
                <p className="schedule-view__muted">Nothing blocking — you can activate when ready.</p>
              ) : (
                <ul className="schedule-view__planning-issues">
                  {planningIssues.map((issue) => (
                    <li
                      key={issue.id}
                      className={`schedule-view__planning-issue schedule-view__planning-issue--${issue.severity}`}
                    >
                      <span className="schedule-view__planning-issue-severity">
                        {issue.severity}
                      </span>
                      <span className="schedule-view__planning-issue-label">{issue.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="schedule-view__planning-section" aria-label="What to do next">
              <h3 className="schedule-view__planning-title">What to do next</h3>
              <p className="schedule-view__planning-focus">{recommendationText}</p>
              {assistantReportStale ? null : assistantReport ? (
                <div className="schedule-view__assistant-details">
                  <h3 className="schedule-view__planning-title">Assistant run details</h3>
                  <p className="schedule-view__muted">
                    {assistantReport.changed.length} updated · {assistantReport.unresolved.length} unresolved
                  </p>
                  <p className="schedule-view__muted">
                    Coverage {toPercent(assistantReport.before.coverageRatio)} → {toPercent(assistantReport.after.coverageRatio)}
                    {' · '}
                    Over-capacity days {assistantReport.before.overCapacityDays} → {assistantReport.after.overCapacityDays}
                  </p>
                </div>
              ) : (
                <p className="schedule-view__muted">Assistant has not been run in this session.</p>
              )}
            </section>
          </div>

          <div className="schedule-view__planning-footer">
            <div className="schedule-view__planning-actions">
              {recommendationCta && (
                <button type="button" className="btn btn--primary btn--sm" onClick={recommendationCta.onClick}>
                  {recommendationCta.label}
                </button>
              )}
              {!readOnly && scheduledPhaseRowCount > 0 && (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleClearAllSchedules}
                >
                  Clear all ({scheduledPhaseRowCount})
                </button>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Handing off...' : 'Hand off'}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className={`btn btn--sm ${isLocked ? 'btn--success' : 'btn--secondary'}`}
                  onClick={handleToggleLock}
                >
                  {isLocked ? 'Revert to Draft' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="schedule-view__top-band-inputs">
          <PlanScheduleInputsPanel
            buildUpStartDate={phaseDates.buildUpStartDate}
            buildUpEndDate={phaseDates.buildUpEndDate}
            tearDownStartDate={phaseDates.tearDownStartDate}
            tearDownEndDate={phaseDates.tearDownEndDate}
            eventStartDate={currentPlan.eventStartDate}
            eventEndDate={currentPlan.eventEndDate}
            defaultCrewSize={currentPlan.defaultCrewSize}
            readOnly={readOnly}
            showBackButton={showBackButton}
            primaryRange={workCalendarRange ?? primaryRange}
            dayCount={currentPlan.workCalendar.length}
            crewSize={currentPlan.defaultCrewSize ?? null}
            totalAvailable={capacity.totalAvailablePersonHours}
            onPhaseDateChange={handlePlanPhaseDateChange}
            onEventDateChange={handlePlanDateChange}
            onDefaultCrewSizeChange={handleDefaultCrewChange}
          />
        </div>
      </div>

      <div ref={workCalendarRef}>
        <WorkCalendarEditor
          calendar={currentPlan.workCalendar}
          readOnly={readOnly}
          onUpdateDay={handleUpdateCalendarDay}
          planDefaultCrewSize={currentPlan.defaultCrewSize}
        />
      </div>

      <div ref={scheduleGridRef} className="schedule-view__grid-stack">
        {assistantReviewIssues.length > 0 && (
          <section className="schedule-view__block schedule-view__assistant-review" aria-live="polite">
            <div className="schedule-view__assistant-review-summary">
              <span className="schedule-view__assistant-review-chip">
                {assistantReviewIssues.length} unresolved {assistantReviewIssues.length === 1 ? 'issue' : 'issues'}
              </span>
              {activeAssistantIssue && (
                <>
                  <span className="schedule-view__assistant-review-chip schedule-view__assistant-review-chip--active">
                    Issue {activeAssistantIssueIndex! + 1} of {assistantReviewIssues.length}
                  </span>
                  <span className="schedule-view__assistant-review-text">
                    {activeAssistantIssue.lineItemTitle} · {activeAssistantIssue.phase} · {unresolvedReasonLabel(activeAssistantIssue.reason)}
                  </span>
                  <span className="schedule-view__assistant-review-text">
                    {activeAssistantIssue.assignedPH.toFixed(1)}h / {activeAssistantIssue.requiredPH.toFixed(1)}h
                  </span>
                </>
              )}
            </div>
            <div className="schedule-view__assistant-review-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={handlePrevAssistantIssue}>
                Prev
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={handleNextAssistantIssue}>
                Next
              </button>
            </div>
          </section>
        )}
        <ScheduleGrid
          lineItems={currentPlan.lineItems}
          calendar={currentPlan.workCalendar}
          capacity={capacity}
          phaseDates={phaseDates}
          readOnly={readOnly}
          onAutoSchedule={handleAutoSchedule}
          onToggleAssignment={handleToggleAssignment}
          onClearRowSchedule={handleClearRowSchedule}
          onCrewForDateChange={handleCrewForDateChange}
          unresolvedIssueKeys={unresolvedIssueKeys}
          activeIssueKey={activeAssistantIssue?.key ?? null}
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
    </div>
  );
}

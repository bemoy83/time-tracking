import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import { type Plan, type PlanLineItem, activatePlan, revertToDraft, getPhaseFields } from '../../lib/planning/plan-model';
import { exportPlanPackage } from '../../lib/interop/data-transfer/plan-package';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { toggleAssignmentDate, getAssignedDates } from '../../lib/planning/scheduling/assignment';
import { lazyMigrateCrewByDate } from '../../lib/planning/scheduling/plan-schedule-update';
import { applyBulkScheduleAmendment, applyScheduleAmendment, type BulkScheduleAmendmentChange } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import type { BuildPhase } from '../../lib/types';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  setPlanPhaseDate,
  updatePlanCalendarDay,
  updateLineItemAssignment,
  updateLineItemCrewForDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { reconcileWorkCalendarForSpans } from '../../lib/planning/scheduling/work-calendar';
import { runAutoSchedule, type AutoScheduleReport } from '../../lib/planning/scheduling/auto-schedule';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { ScheduleGrid, getSchedulableUnscheduledPhaseRowCount } from './schedule/ScheduleGrid';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { PlanScheduleInputsPanel } from './schedule/PlanScheduleInputsPanel';
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

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  showBackButton = true,
  readOnly,
}: ScheduleViewProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const [amendment, setAmendment] = useState<AmendmentState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [assistantReport, setAssistantReport] = useState<AutoScheduleReport | null>(null);
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

  const handlePlanDateChange = (
    field: 'eventStartDate' | 'eventEndDate',
    value: string,
  ) => {
    mutatePlan((prev) => setPlanEventDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handlePlanPhaseDateChange = (
    field: PhaseDateField,
    value: string,
  ) => {
    mutatePlan((prev) => setPlanPhaseDate(prev, field, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleDefaultCrewChange = (value: string) => {
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<Plan['workCalendar'][number]>) => {
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

  const handleAmendmentConfirm = (note: string | null) => {
    if (amendment) {
      applyToggle(amendment.lineItem, amendment.phase, amendment.date, note);
      setAmendment(null);
    }
  };

  const handleAmendmentCancel = () => {
    setAmendment(null);
  };

  const handleAutoSchedule = () => {
    const { plan: scheduledPlan, report } = runAutoSchedule(currentPlan);

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
    setAssistantReport(report);
    trackTelemetryEvent('schedule_assignment_edit');
    trackTelemetryEvent('schedule_assistant_run', {
      changed_count: report.changed.length,
      unresolved_count: report.unresolved.length,
      coverage_ratio_before: report.before.coverageRatio,
      coverage_ratio_after: report.after.coverageRatio,
      over_capacity_days_before: report.before.overCapacityDays,
      over_capacity_days_after: report.after.overCapacityDays,
    });
  };

  const handleCrewForDateChange = (lineItemId: string, phase: BuildPhase, date: string, crew: number) => {
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

  const handleOpenWorkCalendar = () => {
    workCalendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenScheduleGrid = () => {
    scheduleGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const planningIssues: PlanningIssue[] = [];
  if (capacity.overWorkerCapacityDayCount > 0) {
    planningIssues.push({
      id: 'worker-capacity',
      severity: 'critical',
      label: `${capacity.overWorkerCapacityDayCount} ${capacity.overWorkerCapacityDayCount === 1 ? 'day exceeds' : 'days exceed'} worker capacity`,
    });
  }
  if (capacity.overAllocatedDayCount > 0) {
    planningIssues.push({
      id: 'over-allocated',
      severity: 'critical',
      label: `${capacity.overAllocatedDayCount} ${capacity.overAllocatedDayCount === 1 ? 'day is' : 'days are'} over-allocated`,
    });
  }
  if (schedulableUnscheduledCount > 0) {
    planningIssues.push({
      id: 'unscheduled',
      severity: 'warning',
      label: `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'phase row is' : 'phase rows are'} still unscheduled`,
    });
  }
  if ((assistantReport?.unresolved.length ?? 0) > 0) {
    const unresolvedCount = assistantReport!.unresolved.length;
    planningIssues.push({
      id: 'assistant-unresolved',
      severity: 'warning',
      label: `Assistant still has ${unresolvedCount} unresolved ${unresolvedCount === 1 ? 'item' : 'items'}`,
    });
  }
  if (capacity.overStaffedDayCount > 0) {
    planningIssues.push({
      id: 'over-staffed',
      severity: 'info',
      label: `${capacity.overStaffedDayCount} ${capacity.overStaffedDayCount === 1 ? 'day has' : 'days have'} excess crew capacity`,
    });
  }

  const primaryAction = (() => {
    if (readOnly) return null;
    if (capacity.overWorkerCapacityDayCount > 0 || capacity.overAllocatedDayCount > 0) {
      return { label: 'Review calendar fixes', onClick: handleOpenWorkCalendar };
    }
    if ((assistantReport?.unresolved.length ?? 0) > 0) {
      return { label: 'Review assistant issues', onClick: handleOpenScheduleGrid };
    }
    if (schedulableUnscheduledCount > 0) {
      return { label: 'Run assistant', onClick: handleAutoSchedule };
    }
    if (!isLocked) {
      return { label: 'Activate plan', onClick: handleToggleLock };
    }
    return null;
  })();

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
            </div>

            <div className="schedule-view__header-actions">
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? 'Handing off...' : 'Hand off'}
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${isLocked ? 'btn--success' : 'btn--secondary'}`}
                    onClick={handleToggleLock}
                  >
                    {isLocked ? 'Revert to Draft' : 'Activate'}
                  </button>
                </>
              )}
              {readOnly && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? 'Handing off...' : 'Hand off'}
                </button>
              )}
            </div>
          </header>

          <section className="schedule-view__planning-section" aria-label="Planning issues queue">
            <h3 className="schedule-view__planning-title">Planning Issues Queue</h3>
            {planningIssues.length === 0 ? (
              <p className="schedule-view__muted">No planning blockers detected.</p>
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

          <section className="schedule-view__planning-section" aria-label="Next best action">
            <h3 className="schedule-view__planning-title">Next Best Action</h3>
            <div className="schedule-view__planning-actions">
              {primaryAction && (
                <button type="button" className="btn btn--primary btn--sm" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </button>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleOpenWorkCalendar}
              >
                Open Work Calendar
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleOpenScheduleGrid}
              >
                Open Schedule Grid
              </button>
            </div>
            {assistantReport && (
              <details className="schedule-view__assistant-details">
                <summary className="schedule-view__assistant-summary">Assistant run details</summary>
                <p className="schedule-view__muted">
                  {assistantReport.changed.length} updated · {assistantReport.unresolved.length} unresolved
                </p>
                <p className="schedule-view__muted">
                  Coverage {toPercent(assistantReport.before.coverageRatio)} → {toPercent(assistantReport.after.coverageRatio)}
                  {' · '}
                  Over-capacity days {assistantReport.before.overCapacityDays} → {assistantReport.after.overCapacityDays}
                </p>
              </details>
            )}
          </section>
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

      <div ref={scheduleGridRef}>
        <ScheduleGrid
          lineItems={currentPlan.lineItems}
          calendar={currentPlan.workCalendar}
          capacity={capacity}
          phaseDates={phaseDates}
          readOnly={readOnly}
          onAutoSchedule={handleAutoSchedule}
          onToggleAssignment={handleToggleAssignment}
          onCrewForDateChange={handleCrewForDateChange}
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

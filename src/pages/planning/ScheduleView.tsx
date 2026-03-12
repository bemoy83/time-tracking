import { useEffect, useMemo, useState } from 'react';
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
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { FeasibilityBar } from './schedule/FeasibilityBar';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';
import { ScheduleInputsBlock } from './schedule/ScheduleInputsBlock';
import { ConflictResolutionBanner } from './schedule/ConflictResolutionBanner';
import { useMediaQuery } from '../../lib/hooks/useMediaQuery';
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
  const isEmpty = primaryRange == null;
  const [inputsExpanded, setInputsExpanded] = useState(isEmpty);
  const isDesktopTopBand = useMediaQuery('(min-width: 1200px)');
  const scheduleInputsExpanded = isDesktopTopBand ? true : inputsExpanded;

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

          <FeasibilityBar capacity={capacity} />
          <ConflictResolutionBanner capacity={capacity} />
          {assistantReport && (
            <section className="schedule-view__block schedule-view__block--compact" aria-live="polite">
              <h3 className="schedule-view__block-title">Assistant Run Summary</h3>
              <p className="schedule-view__muted">
                {assistantReport.changed.length} updated · {assistantReport.unresolved.length} unresolved
              </p>
              <p className="schedule-view__muted">
                Coverage {toPercent(assistantReport.before.coverageRatio)} → {toPercent(assistantReport.after.coverageRatio)}
                {' · '}
                Over-capacity days {assistantReport.before.overCapacityDays} → {assistantReport.after.overCapacityDays}
              </p>
            </section>
          )}
        </section>

        <div className="schedule-view__top-band-inputs">
          <ScheduleInputsBlock
            expanded={scheduleInputsExpanded}
            onToggle={() => setInputsExpanded((prev) => !prev)}
            collapsible={!isDesktopTopBand}
            primaryRange={workCalendarRange ?? primaryRange}
            dayCount={currentPlan.workCalendar.length}
            crewSize={currentPlan.defaultCrewSize ?? null}
            totalAvailable={capacity.totalAvailablePersonHours}
          >
            <PlanScheduleInputs
              buildUpStartDate={phaseDates.buildUpStartDate}
              buildUpEndDate={phaseDates.buildUpEndDate}
              tearDownStartDate={phaseDates.tearDownStartDate}
              tearDownEndDate={phaseDates.tearDownEndDate}
              eventStartDate={currentPlan.eventStartDate}
              eventEndDate={currentPlan.eventEndDate}
              defaultCrewSize={currentPlan.defaultCrewSize}
              readOnly={readOnly}
              onPhaseDateChange={handlePlanPhaseDateChange}
              onEventDateChange={handlePlanDateChange}
              onDefaultCrewSizeChange={handleDefaultCrewChange}
            />
          </ScheduleInputsBlock>
        </div>
      </div>

      <WorkCalendarEditor
        calendar={currentPlan.workCalendar}
        readOnly={readOnly}
        onUpdateDay={handleUpdateCalendarDay}
        planDefaultCrewSize={currentPlan.defaultCrewSize}
      />

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

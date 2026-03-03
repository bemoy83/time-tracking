import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronIcon } from '../../components/icons';
import { type Plan, type PlanLineItem, activatePlan, revertToDraft } from '../../lib/planning/plan-model';
import { exportPlanPackage } from '../../lib/interop/data-transfer/plan-package';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { toggleAssignmentDate, getAssignedDates } from '../../lib/planning/scheduling/assignment';
import { applyScheduleAmendment } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  updatePlanCalendarDay,
  updateLineItemAssignment,
  updateLineItemCrewForDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { reconcileWorkCalendar } from '../../lib/planning/scheduling/work-calendar';
import { autoSchedule } from '../../lib/planning/scheduling/auto-schedule';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { FeasibilityBar } from './schedule/FeasibilityBar';
import { EventContextBar } from './schedule/EventContextBar';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';
import { ConflictResolutionBanner } from './schedule/ConflictResolutionBanner';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  readOnly: boolean;
}

interface AmendmentState {
  lineItem: PlanLineItem;
  date: string;
  isAssigning: boolean;
  anchor: HTMLElement;
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  readOnly,
}: ScheduleViewProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const [amendment, setAmendment] = useState<AmendmentState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const isEmpty = !currentPlan.eventStartDate || !currentPlan.eventEndDate;
  const [inputsExpanded, setInputsExpanded] = useState(isEmpty);
  const inputsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    trackTelemetryEvent('schedule_tab_open');
  }, [plan.id]);

  // Derive work calendar when event dates exist but workCalendar is empty (e.g. dates set
  // in plan editor and user switched to schedule before debounced save completed).
  useEffect(() => {
    const hasEventDates =
      currentPlan.eventStartDate != null && currentPlan.eventEndDate != null;
    if (hasEventDates && currentPlan.workCalendar.length === 0) {
      mutatePlan((prev) => ({
        ...prev,
        workCalendar: reconcileWorkCalendar(
          prev.workCalendar,
          prev.eventStartDate,
          prev.eventEndDate,
          prev.defaultCrewSize,
        ),
      }));
    }
  }, [
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
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

  const handleDefaultCrewChange = (value: string) => {
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<Plan['workCalendar'][number]>) => {
    mutatePlan((prev) => updatePlanCalendarDay(prev, date, updates));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleToggleAssignment = (lineItem: PlanLineItem, date: string, cellElement?: HTMLElement) => {
    if (currentPlan.status === 'active' && cellElement) {
      const assignedDates = getAssignedDates(lineItem);
      const isAssigning = !assignedDates.includes(date);
      setAmendment({ lineItem, date, isAssigning, anchor: cellElement });
      return;
    }
    applyToggle(lineItem, date, null);
  };

  const applyToggle = (lineItem: PlanLineItem, date: string, amendmentNote: string | null) => {
    mutatePlan((prev) => {
      const currentLineItem = prev.lineItems.find((item) => item.id === lineItem.id);
      if (!currentLineItem) return prev;
      const nextSpan = toggleAssignmentDate(currentLineItem, date);
      if (prev.status === 'active') {
        return applyScheduleAmendment(
          prev,
          currentLineItem,
          nextSpan.scheduledStart,
          nextSpan.scheduledEnd,
          amendmentNote,
        );
      }
      return updateLineItemAssignment(prev, currentLineItem.id, nextSpan);
    });
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handleAmendmentConfirm = (note: string | null) => {
    if (amendment) {
      applyToggle(amendment.lineItem, amendment.date, note);
      setAmendment(null);
    }
  };

  const handleAmendmentCancel = () => {
    setAmendment(null);
  };

  const handleAutoSchedule = () => {
    mutatePlan((prev) => autoSchedule(prev));
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handleCrewForDateChange = (lineItemId: string, date: string, crew: number) => {
    mutatePlan((prev) => updateLineItemCrewForDate(prev, lineItemId, date, crew));
    trackTelemetryEvent('schedule_assignment_edit');
  };

  const handleEditInputs = () => {
    setInputsExpanded(true);
    requestAnimationFrame(() => {
      inputsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Back
        </button>
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Schedule
        </h2>
        <div className="schedule-view__header-actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => window.print()}
            aria-label="Print schedule"
          >
            Print
          </button>
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

      <EventContextBar
        eventStartDate={currentPlan.eventStartDate}
        eventEndDate={currentPlan.eventEndDate}
        calendarDayCount={currentPlan.workCalendar.length}
        defaultCrewSize={currentPlan.defaultCrewSize}
        totalAvailableHours={capacity.totalAvailablePersonHours}
        onEdit={handleEditInputs}
      />

      <FeasibilityBar capacity={capacity} />
      <ConflictResolutionBanner capacity={capacity} />

      <section className="schedule-view__block schedule-view__block--compact" ref={inputsRef}>
        <header className="schedule-view__block-header">
          <button
            type="button"
            className="schedule-view__block-toggle"
            onClick={() => setInputsExpanded((prev) => !prev)}
            aria-expanded={inputsExpanded}
          >
            <ChevronIcon
              className={`schedule-view__block-chevron${inputsExpanded ? ' schedule-view__block-chevron--expanded' : ''}`}
            />
            <h3 className="schedule-view__block-title">
              Event Inputs
              {!inputsExpanded &&
                currentPlan.eventStartDate &&
                currentPlan.eventEndDate && (
                  <span className="schedule-view__block-summary">
                    {' '}
                    — {new Date(`${currentPlan.eventStartDate}T00:00:00`).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                    –
                    {new Date(`${currentPlan.eventEndDate}T00:00:00`).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                    · {currentPlan.workCalendar.length}{' '}
                    {currentPlan.workCalendar.length === 1 ? 'day' : 'days'} ·{' '}
                    {currentPlan.defaultCrewSize ?? '–'} crew · {capacity.totalAvailablePersonHours.toFixed(0)}h
                    available
                  </span>
                )}
            </h3>
          </button>
        </header>
        {inputsExpanded && (
          <PlanScheduleInputs
            eventStartDate={currentPlan.eventStartDate}
            eventEndDate={currentPlan.eventEndDate}
            defaultCrewSize={currentPlan.defaultCrewSize}
            readOnly={readOnly}
            onEventDateChange={handlePlanDateChange}
            onDefaultCrewSizeChange={handleDefaultCrewChange}
          />
        )}
      </section>

      <WorkCalendarEditor
        calendar={currentPlan.workCalendar}
        readOnly={readOnly}
        onUpdateDay={handleUpdateCalendarDay}
        planDefaultCrewSize={currentPlan.defaultCrewSize}
      />

      {!readOnly && capacity.unscheduledLineItemCount > 0 && currentPlan.workCalendar.length > 0 && (
        <div className="schedule-view__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleAutoSchedule}
          >
            Auto-schedule ({capacity.unscheduledLineItemCount})
          </button>
        </div>
      )}

      <ScheduleGrid
        lineItems={currentPlan.lineItems}
        calendar={currentPlan.workCalendar}
        capacity={capacity}
        readOnly={readOnly}
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

import { useEffect, useMemo } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import { type Plan, type PlanLineItem, updatePlanLineItem } from '../../lib/planning/plan-model';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { toggleAssignmentDate } from '../../lib/planning/scheduling/assignment';
import { applyScheduleAmendment } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  updatePlanCalendarDay,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { CapacitySummaryPanel } from './schedule/CapacitySummaryPanel';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  readOnly: boolean;
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  readOnly,
}: ScheduleViewProps) {
  const { currentPlan, mutatePlan } = usePlanEditorState({ plan, onSave });

  useEffect(() => {
    trackTelemetryEvent('schedule_tab_open');
  }, [plan.id]);

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

  const handleToggleAssignment = (lineItem: PlanLineItem, date: string) => {
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
          currentLineItem.amendmentNote,
        );
      }
      return updatePlanLineItem(prev, currentLineItem.id, nextSpan);
    });
    trackTelemetryEvent('schedule_assignment_edit');
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
      </header>

      <section className="schedule-view__block">
        <header className="schedule-view__block-header">
          <h3 className="schedule-view__block-title">Event Inputs</h3>
        </header>
        <PlanScheduleInputs
          eventStartDate={currentPlan.eventStartDate}
          eventEndDate={currentPlan.eventEndDate}
          defaultCrewSize={currentPlan.defaultCrewSize}
          readOnly={readOnly}
          onEventDateChange={handlePlanDateChange}
          onDefaultCrewSizeChange={handleDefaultCrewChange}
        />
      </section>

      <WorkCalendarEditor
        calendar={currentPlan.workCalendar}
        readOnly={readOnly}
        onUpdateDay={handleUpdateCalendarDay}
      />

      <ScheduleGrid
        lineItems={currentPlan.lineItems}
        calendar={currentPlan.workCalendar}
        capacity={capacity}
        readOnly={readOnly}
        onToggleAssignment={handleToggleAssignment}
      />

      <CapacitySummaryPanel capacity={capacity} />
    </div>
  );
}

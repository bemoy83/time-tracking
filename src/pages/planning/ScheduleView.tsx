import { useEffect, useMemo } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import { type Plan, type PlanLineItem, updatePlanLineItem } from '../../lib/planning/plan-model';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { reconcileWorkCalendar } from '../../lib/planning/scheduling/work-calendar';
import { computeCapacitySummary } from '../../lib/planning/scheduling/capacity';
import { toggleAssignmentDate } from '../../lib/planning/scheduling/assignment';
import { applyScheduleAmendment } from '../../lib/planning/scheduling/amendments';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { WorkCalendarEditor } from './schedule/WorkCalendarEditor';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { CapacitySummaryPanel } from './schedule/CapacitySummaryPanel';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  readOnly: boolean;
}

function normalizeCrewInput(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
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
    mutatePlan((prev) => {
      const next = {
        ...prev,
        [field]: value || null,
      };
      return {
        ...next,
        workCalendar: reconcileWorkCalendar(
          next.workCalendar,
          next.eventStartDate,
          next.eventEndDate,
          next.defaultCrewSize,
        ),
      };
    });
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleDefaultCrewChange = (value: string) => {
    const defaultCrewSize = normalizeCrewInput(value);
    mutatePlan((prev) => {
      const next = { ...prev, defaultCrewSize };
      return {
        ...next,
        workCalendar: reconcileWorkCalendar(
          next.workCalendar,
          next.eventStartDate,
          next.eventEndDate,
          next.defaultCrewSize,
        ),
      };
    });
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleUpdateCalendarDay = (date: string, updates: Partial<Plan['workCalendar'][number]>) => {
    mutatePlan((prev) => ({
      ...prev,
      workCalendar: prev.workCalendar.map((day) =>
        day.date === date ? { ...day, ...updates } : day,
      ),
    }));
    trackTelemetryEvent('schedule_calendar_edit');
  };

  const handleToggleAssignment = (lineItem: PlanLineItem, date: string) => {
    mutatePlan((prev) => {
      const nextSpan = toggleAssignmentDate(lineItem, date);
      if (prev.status === 'active') {
        return applyScheduleAmendment(
          prev,
          lineItem,
          nextSpan.scheduledStart,
          nextSpan.scheduledEnd,
          lineItem.amendmentNote,
        );
      }
      return updatePlanLineItem(prev, lineItem.id, nextSpan);
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
        <div className="schedule-view__inputs">
          <label className="schedule-view__input">
            <span>Event start</span>
            <input
              className="input"
              type="date"
              value={currentPlan.eventStartDate ?? ''}
              disabled={readOnly}
              onChange={(event) => handlePlanDateChange('eventStartDate', event.target.value)}
            />
          </label>
          <label className="schedule-view__input">
            <span>Event end</span>
            <input
              className="input"
              type="date"
              value={currentPlan.eventEndDate ?? ''}
              disabled={readOnly}
              onChange={(event) => handlePlanDateChange('eventEndDate', event.target.value)}
            />
          </label>
          <label className="schedule-view__input">
            <span>Default crew size</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={currentPlan.defaultCrewSize ?? ''}
              disabled={readOnly}
              onChange={(event) => handleDefaultCrewChange(event.target.value)}
            />
          </label>
        </div>
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

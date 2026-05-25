import { useCallback, useRef, useState } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import { ScheduleMetricStrip } from './schedule/ScheduleMetricStrip';
import { type Plan } from '../../lib/planning/plan-model';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { DayEditPopover } from './schedule/grid/DayEditPopover';
import { ScheduleAssistantPanel } from './schedule/ScheduleAssistantPanel';
import { type ScheduleEditContextValue } from './workspace/ScheduleEditContext';
import { useScheduleViewState } from './hooks/useScheduleViewState';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  showBackButton?: boolean;
  readOnly: boolean;
  onScheduleContextChange?: (ctx: ScheduleEditContextValue | null) => void;
}

export function ScheduleView({
  plan,
  onSave,
  onBack,
  showBackButton = true,
  readOnly,
  onScheduleContextChange,
}: ScheduleViewProps) {
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(false);
  const [dayEdit, setDayEdit] = useState<{ date: string; anchor: HTMLElement } | null>(null);

  const handleEditDay = useCallback((date: string, anchor: HTMLElement) => {
    setDayEdit((prev) => (prev?.date === date ? null : { date, anchor }));
  }, []);

  const {
    currentPlan,
    scheduleKpiMetrics,
    scheduleSteps,
    phaseDates,
    capacity,
    schedulableUnscheduledCount,
    criticalIssueCount,
    warningIssueCount,
    planningIssues,
    issuePanelPayload,
    unresolvedIssueKeys,
    activeAssistantIssue,
    isLocked,
    todayIso,
    amendment,
    handleAutoSchedule,
    handleToggleAssignment,
    handleToggleWorkday,
    handleClearRowSchedule,
    handlePersonHoursForDateChange,
    handleUpdateCalendarDay,
    handleAmendmentConfirm,
    handleAmendmentCancel,
    handleRevertToDraft,
  } = useScheduleViewState({ plan, onSave, readOnly, onScheduleContextChange, scheduleGridRef });

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
            className="btn btn--secondary btn--sm"
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
          onEditDay={readOnly ? undefined : handleEditDay}
          todayIso={todayIso}
          eventStartDate={currentPlan.eventStartDate}
          eventEndDate={currentPlan.eventEndDate}
        />
      </div>

      {dayEdit && (() => {
        const editDay = currentPlan.workCalendar.find((d) => d.date === dayEdit.date);
        if (!editDay) return null;
        return (
          <DayEditPopover
            anchor={dayEdit.anchor}
            day={editDay}
            defaultCrewSize={currentPlan.defaultCrewSize}
            onUpdate={handleUpdateCalendarDay}
            onClose={() => setDayEdit(null)}
          />
        );
      })()}

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

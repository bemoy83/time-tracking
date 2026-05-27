import { useCallback, useRef, useState } from 'react';
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
    assistantIssueCount,
    assistantCriticalIssueCount,
    assistantWarningIssueCount,
    issuePanelPayload,
    unresolvedIssueKeys,
    activeAssistantIssue,
    isLocked,
    todayIso,
    amendment,
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
      <ScheduleMetricStrip
        metrics={scheduleKpiMetrics}
        steps={scheduleSteps}
        readOnly={readOnly}
        issueCount={assistantIssueCount}
        criticalIssueCount={assistantCriticalIssueCount}
        warningIssueCount={assistantWarningIssueCount}
        onOpenAssistant={() => setIsAssistantPanelOpen(true)}
        isLocked={isLocked}
        onRevertToDraft={handleRevertToDraft}
      />

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

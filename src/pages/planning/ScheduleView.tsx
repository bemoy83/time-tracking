import { useCallback, useMemo, useRef, useState } from 'react';
import { ScheduleMetricStrip } from './schedule/ScheduleMetricStrip';
import { type Plan } from '../../lib/planning/plan-model';
import { ScheduleGrid } from './schedule/ScheduleGrid';
import { AmendmentPopover } from './schedule/AmendmentPopover';
import { DayEditPopover } from './schedule/grid/DayEditPopover';
import { ScheduleAssistantPanel } from './schedule/ScheduleAssistantPanel';
import { type ScheduleEditContextValue } from './workspace/ScheduleEditContext';
import { useScheduleViewState } from './hooks/useScheduleViewState';
import { generateFullSpanVirtualDays } from '../../lib/planning/scheduling/work-calendar';
import { getFullEventSpan } from './schedule/schedule-date-ui';

interface ScheduleViewProps {
  plan: Plan;
  onSave: (plan: Plan) => void;
  readOnly: boolean;
  onScheduleContextChange?: (ctx: ScheduleEditContextValue | null) => void;
  topLevelAccentColor?: string | null;
}

export function ScheduleView({
  plan,
  onSave,
  readOnly,
  onScheduleContextChange,
  topLevelAccentColor,
}: ScheduleViewProps) {
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(false);
  const [dayEdit, setDayEdit] = useState<{ date: string; anchor: HTMLElement } | null>(null);
  const [showFullSpan, setShowFullSpan] = useState(false);

  const handleEditDay = useCallback((date: string, anchor: HTMLElement) => {
    setDayEdit((prev) => (prev?.date === date ? null : { date, anchor }));
  }, []);

  const handleToggleFullSpan = useCallback(() => setShowFullSpan((prev) => !prev), []);

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

  const fullEventSpan = useMemo(
    () => getFullEventSpan(phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate),
    [phaseDates, currentPlan.eventStartDate, currentPlan.eventEndDate],
  );

  const displayCalendar = useMemo(() => {
    if (!showFullSpan || fullEventSpan == null) return currentPlan.workCalendar;
    return generateFullSpanVirtualDays(fullEventSpan, currentPlan.workCalendar, currentPlan.defaultCrewSize);
  }, [showFullSpan, fullEventSpan, currentPlan.workCalendar, currentPlan.defaultCrewSize]);

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
        showFullSpan={showFullSpan}
        onToggleFullSpan={fullEventSpan != null ? handleToggleFullSpan : undefined}
      />

      <div ref={scheduleGridRef} className="schedule-view__grid-stack">
        <ScheduleGrid
          planId={currentPlan.id}
          lineItems={currentPlan.lineItems}
          calendar={displayCalendar}
          capacity={capacity}
          phaseDates={phaseDates}
          eventStartDate={currentPlan.eventStartDate}
          eventEndDate={currentPlan.eventEndDate}
          readOnly={readOnly}
          onToggleAssignment={handleToggleAssignment}
          onClearRowSchedule={handleClearRowSchedule}
          onPersonHoursForDateChange={handlePersonHoursForDateChange}
          unresolvedIssueKeys={unresolvedIssueKeys}
          activeIssueKey={activeAssistantIssue?.key ?? null}
          onToggleWorkday={readOnly ? undefined : handleToggleWorkday}
          onEditDay={readOnly ? undefined : handleEditDay}
          todayIso={todayIso}
          topLevelAccentColor={topLevelAccentColor}

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

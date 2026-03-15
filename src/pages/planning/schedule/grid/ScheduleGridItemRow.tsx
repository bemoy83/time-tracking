import { PeopleIcon, UndoIcon, WarningIcon } from '../../../../components/icons';
import { getPhaseFields } from '../../../../lib/planning/plan-model';
import { BUILD_PHASE_LABELS, WORK_UNIT_LABELS } from '../../../../lib/types';
import {
  getLastDayBreakdown,
  getScheduledHours,
  getWorkHoursForDay,
  isOverTargetCell as isOverTargetCellBreakdown,
  isOverWorkerForDay,
} from './schedule-grid-metrics';
import type { ItemRowRenderInput } from './schedule-grid-types';
import { isDateWithinSpan } from '../schedule-date-ui';

export function ScheduleGridItemRow({
  rowKey,
  rowIndex,
  item,
  phase,
  assignedDates,
  calendar,
  dayByDate,
  gridColumns: _gridColumns,
  phaseRange,
  hasPhaseWindows,
  readOnly,
  metaPrefix,
  onToggleAssignment,
  onClearSchedule,
  onCrewForDateChange,
  outOfPhaseAriaUsesLabel,
  readOnlyTitle,
  isAssistantUnresolved = false,
  isAssistantActive = false,
}: ItemRowRenderInput) {
  const pf = getPhaseFields(item, phase);
  const assigned = new Set(assignedDates);

  const hasAssignments = assigned.size > 0;
  const estimateHours = pf.timeHours * pf.crew;
  const scheduledHours = hasAssignments ? getScheduledHours(item, phase, assignedDates, dayByDate) : 0;
  const isOnTarget = hasAssignments && scheduledHours >= estimateHours - 0.01;
  const isUnderTarget = hasAssignments && scheduledHours < estimateHours - 0.01;
  const isOverTarget = hasAssignments && scheduledHours > estimateHours + 0.01;
  const isUnscheduled = !hasAssignments;
  const rowStatusClass = isUnscheduled
    ? 'schedule-grid__row--unscheduled'
    : isUnderTarget
      ? 'schedule-grid__row--under-target'
      : isOnTarget
        ? 'schedule-grid__row--on-target'
        : isOverTarget
          ? 'schedule-grid__row--over-target'
          : '';
  const unresolvedClass = isAssistantUnresolved ? ' schedule-grid__row--assistant-unresolved' : '';
  const activeClass = isAssistantActive ? ' schedule-grid__row--assistant-active' : '';

  return (
    <div className="schedule-grid__row-wrapper">
      <div
        data-row-key={rowKey}
        className={`schedule-grid__row${rowStatusClass ? ` ${rowStatusClass}` : ''}${unresolvedClass}${activeClass}`}
        role="row"
        aria-rowindex={rowIndex + 2}
      >
        <div className={`schedule-grid__line-item${metaPrefix ? ' schedule-grid__line-item--shared' : ''}`} role="rowheader">
          <span className="schedule-grid__line-item-heading">
            <span className="schedule-grid__line-item-heading-main">
              <span className="schedule-grid__line-item-title">{item.title}</span>
              {isAssistantUnresolved && (
                <span
                  className={`schedule-grid__assistant-issue-badge${isAssistantActive ? ' schedule-grid__assistant-issue-badge--active' : ''}`}
                  aria-label={isAssistantActive ? 'Active assistant issue' : 'Assistant issue'}
                >
                  {isAssistantActive ? 'Reviewing issue' : 'Assistant issue'}
                </span>
              )}
            </span>
            {!readOnly && hasAssignments && onClearSchedule && (
              <button
                type="button"
                className="schedule-grid__row-clear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSchedule();
                }}
                aria-label={`Clear schedule for ${item.title} (${BUILD_PHASE_LABELS[phase]})`}
                title="Clear this row schedule"
              >
                <UndoIcon className="schedule-grid__row-clear-icon" aria-hidden />
              </button>
            )}
          </span>
          <span className="schedule-grid__line-item-meta">
            {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]}
            {metaPrefix ? ` · ${metaPrefix}` : ''} ·{' '}
            {hasAssignments ? (
              <>
                <span
                  className={`schedule-grid__hours-compare${scheduledHours < estimateHours - 0.01 ? ' schedule-grid__hours-compare--under' : ''}`}
                  title={`Scheduled: ${scheduledHours.toFixed(1)}h of estimate ${estimateHours.toFixed(1)}h`}
                >
                  {scheduledHours.toFixed(1)}h / {estimateHours.toFixed(1)}h
                </span>
                <span
                  className={`schedule-grid__estimate-badge${
                    scheduledHours < estimateHours - 0.01
                      ? ' schedule-grid__estimate-badge--under'
                      : scheduledHours > estimateHours + 0.01
                        ? ' schedule-grid__estimate-badge--over'
                        : ' schedule-grid__estimate-badge--at'
                  }`}
                  title={scheduledHours < estimateHours - 0.01 ? 'Under estimate' : scheduledHours > estimateHours + 0.01 ? 'Over estimate (excess capacity)' : 'Matches estimate'}
                >
                  {Math.round((scheduledHours / estimateHours) * 100)}%
                </span>
              </>
            ) : (
              <span>{estimateHours.toFixed(1)}h</span>
            )}
          </span>
        </div>
        {calendar.map((day, colIdx) => {
          const isAssigned = assigned.has(day.date);
          const isOutOfPhase = hasPhaseWindows && !isDateWithinSpan(day.date, phaseRange);
          const isPhaseMismatch = isAssigned && isOutOfPhase;
          const cap = dayByDate.get(day.date);
          const isOver = cap?.isOverAllocated ?? false;
          const isOverCrew = cap?.isOverAssignedCrew ?? false;
          const isOverWorker = isAssigned && isOverWorkerForDay(item, phase, day.date, dayByDate, assignedDates);
          const crewValue = isAssigned && day.isWorkDay ? (pf.crewByDate?.[day.date] ?? pf.crew) : 0;
          const lastDayBd = isAssigned ? getLastDayBreakdown(item, phase, day.date, dayByDate, assignedDates) : null;
          const isOverTargetCell = isOverTargetCellBreakdown(lastDayBd);
          const isTargetMet =
            isAssigned && isOnTarget && !isOver && !isOverCrew && !isOverWorker && !isOverTargetCell;

          const isCellDisabled = readOnly || !day.isWorkDay || isOutOfPhase;

          return (
            <div
              key={`${item.id}:${phase}:${day.date}`}
              role="gridcell"
              aria-colindex={colIdx + 2}
              aria-disabled={isCellDisabled ? 'true' : undefined}
              tabIndex={isCellDisabled ? -1 : 0}
              className={`schedule-grid__cell${isAssigned ? ' schedule-grid__cell--assigned' : ''}${isTargetMet ? ' schedule-grid__cell--on-target' : ''}${isOverTargetCell ? ' schedule-grid__cell--over-target' : ''}${day.isWorkDay ? '' : ' schedule-grid__cell--off'}${isOutOfPhase ? ' schedule-grid__cell--phase-locked' : ''}${isPhaseMismatch ? ' schedule-grid__cell--phase-mismatch' : ''}${isOver && isAssigned ? ' schedule-grid__cell--over' : ''}${isOverCrew && isAssigned ? ' schedule-grid__cell--over-crew' : ''}${isOverWorker ? ' schedule-grid__cell--over-worker' : ''}`}
              onClick={(e) => {
                if (isCellDisabled) return;
                if ((e.target as HTMLElement).closest('.schedule-grid__cell-crew-btn')) return;
                onToggleAssignment(day.date, e.currentTarget);
              }}
              title={
                readOnly && readOnlyTitle
                  ? readOnlyTitle
                  : isOutOfPhase
                    ? `Outside ${BUILD_PHASE_LABELS[phase]} window`
                    : isOverWorker
                      ? 'Exceeds worker capacity (add crew or days)'
                      : isAssigned
                        ? 'Click to unassign'
                        : 'Click to assign'
              }
              aria-label={
                isOutOfPhase && outOfPhaseAriaUsesLabel
                  ? `${item.title} on ${day.date} is outside ${BUILD_PHASE_LABELS[phase]} window`
                  : `Toggle ${item.title} on ${day.date}`
              }
            >
              {isAssigned ? (
                <>
                  {(() => {
                    const hours = getWorkHoursForDay(item, phase, day.date, dayByDate, assignedDates);
                    if (hours <= 0) return null;
                    const lastDayBreakdown = getLastDayBreakdown(item, phase, day.date, dayByDate, assignedDates);
                    if (lastDayBreakdown == null) {
                      return <span className="schedule-grid__cell-badge">{hours.toFixed(1)}h</span>;
                    }
                    const { assignedPersonHours, remainingAtStart, deficit } = lastDayBreakdown;
                    const isDeficit = deficit != null;
                    const isOverCell = !isDeficit && assignedPersonHours > remainingAtStart + 0.01;
                    return (
                      <span className={`schedule-grid__cell-badge${isDeficit ? ' schedule-grid__cell-badge--need' : isOverCell ? ' schedule-grid__cell-badge--over' : ''}`}>
                        {assignedPersonHours.toFixed(1)}h / {remainingAtStart.toFixed(1)}h
                      </span>
                    );
                  })()}
                  {day.isWorkDay && (
                    <div className="schedule-grid__cell-crew">
                      {!readOnly && onCrewForDateChange ? (
                        <>
                          <button
                            type="button"
                            className="schedule-grid__cell-crew-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (crewValue > 0) onCrewForDateChange(day.date, crewValue - 1);
                            }}
                            disabled={crewValue <= 0}
                            aria-label={`Decrease crew for ${item.title} on ${day.date}`}
                          >
                            −
                          </button>
                          {isOverWorker ? (
                            <WarningIcon className="schedule-grid__cell-icon schedule-grid__cell-icon--warning" aria-label="Exceeds worker capacity" />
                          ) : (
                            <PeopleIcon className="schedule-grid__cell-icon" aria-hidden />
                          )}
                          <span className="schedule-grid__cell-crew-value">{crewValue}</span>
                          <button
                            type="button"
                            className="schedule-grid__cell-crew-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (crewValue < 99) onCrewForDateChange(day.date, crewValue + 1);
                            }}
                            disabled={crewValue >= 99}
                            aria-label={`Increase crew for ${item.title} on ${day.date}`}
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <>
                          {isOverWorker ? (
                            <WarningIcon className="schedule-grid__cell-icon schedule-grid__cell-icon--warning" aria-label="Exceeds worker capacity" />
                          ) : (
                            <PeopleIcon className="schedule-grid__cell-icon" aria-hidden />
                          )}
                          <span className="schedule-grid__cell-crew-value">{crewValue}</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

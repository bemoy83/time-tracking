import { useEffect, useState } from 'react';
import { PeopleIcon, UndoIcon, WarningIcon } from '../../../../components/icons';
import { getPhaseFields } from '../../../../lib/planning/plan-model';
import { getCrewEquivalentForDate, resolveEffectiveAccessHours } from '../../../../lib/planning/scheduling/capacity-math';
import { BUILD_PHASE_LABELS, formatQuantityWithUnit } from '../../../../lib/types';
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
  onPersonHoursForDateChange,
  outOfPhaseAriaUsesLabel,
  readOnlyTitle,
  isAssistantUnresolved = false,
  isAssistantActive = false,
}: ItemRowRenderInput) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [personHoursDraft, setPersonHoursDraft] = useState('');
  const pf = getPhaseFields(item, phase);
  const assigned = new Set(assignedDates);
  const editingIsAssigned = editingDate != null ? assigned.has(editingDate) : false;
  const editingPersonHours = editingDate != null ? pf.personHoursByDate?.[editingDate] : undefined;

  useEffect(() => {
    if (editingDate == null) return;
    if (!editingIsAssigned) {
      setEditingDate(null);
      setPersonHoursDraft('');
      return;
    }
    if (editingPersonHours != null) {
      setPersonHoursDraft(String(editingPersonHours));
    }
  }, [editingDate, editingIsAssigned, editingPersonHours, rowKey]);

  const hasAssignments = assigned.size > 0;
  const estimateHours = Math.round(pf.timeHours * pf.crew * 10) / 10;
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

  const commitPersonHoursChange = (date: string) => {
    if (!onPersonHoursForDateChange) {
      setEditingDate(null);
      setPersonHoursDraft('');
      return;
    }
    const trimmed = personHoursDraft.trim();
    const parsed = trimmed === '' ? 0 : Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      const previous = pf.personHoursByDate?.[date];
      setPersonHoursDraft(previous != null ? String(previous) : '');
      setEditingDate(null);
      return;
    }
    onPersonHoursForDateChange(date, Number(parsed.toFixed(2)));
    setEditingDate(null);
    setPersonHoursDraft('');
  };

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
                  aria-label={isAssistantActive ? 'Schedule issue in review' : 'Schedule issue'}
                >
                  {isAssistantActive ? 'In review' : 'Schedule issue'}
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
            {formatQuantityWithUnit(item.workQuantity, item.workUnit)}
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
          const effectiveAccessHours = resolveEffectiveAccessHours(
            cap?.effectiveAvailablePersonHours ?? 0,
            cap?.availableCrew ?? 0,
            cap?.accessHours ?? 8,
          );
          const crewValue = isAssigned && day.isWorkDay
            ? getCrewEquivalentForDate(item, phase, day.date, effectiveAccessHours)
            : 0;
          const lastDayBd = isAssigned ? getLastDayBreakdown(item, phase, day.date, dayByDate, assignedDates) : null;
          const isOverTargetCell = isOverTargetCellBreakdown(lastDayBd);
          const isTargetMet =
            isAssigned && isOnTarget && !isOver && !isOverCrew && !isOverWorker && !isOverTargetCell;
          const isEditing = editingDate === day.date;

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
                if ((e.target as HTMLElement).closest('.schedule-grid__cell-hours-btn, .schedule-grid__cell-editor')) return;
                onToggleAssignment(day.date, e.currentTarget);
              }}
              title={
                readOnly && readOnlyTitle
                  ? readOnlyTitle
                  : isOutOfPhase
                    ? `Outside ${BUILD_PHASE_LABELS[phase]} window`
                    : isAssigned && !isCellDisabled && onPersonHoursForDateChange
                      ? 'Click hours to edit, or click the cell background to unassign'
                    : isOverWorker
                      ? 'Under planned effort on final assigned day'
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
                  {isEditing ? (
                    <label
                      className="schedule-grid__cell-editor"
                      aria-label={`Edit planned hours for ${item.title} on ${day.date}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        className="schedule-grid__cell-hours-input"
                        type="text"
                        inputMode="decimal"
                        value={personHoursDraft}
                        onChange={(event) => setPersonHoursDraft(event.target.value)}
                        onFocus={(event) => event.target.select()}
                        onBlur={() => commitPersonHoursChange(day.date)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitPersonHoursChange(day.date);
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditingDate(null);
                            setPersonHoursDraft('');
                          }
                        }}
                        autoFocus
                      />
                      <span className="schedule-grid__cell-hours-unit">h</span>
                    </label>
                  ) : (() => {
                    const hours = getWorkHoursForDay(item, phase, day.date, dayByDate, assignedDates);
                    if (hours <= 0) return null;
                    const lastDayBreakdown = getLastDayBreakdown(item, phase, day.date, dayByDate, assignedDates);
                    if (lastDayBreakdown == null) {
                      return onPersonHoursForDateChange && !isCellDisabled ? (
                        <button
                          type="button"
                          className="schedule-grid__cell-hours-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingDate(day.date);
                            setPersonHoursDraft(String(hours));
                          }}
                          aria-label={`Edit planned hours for ${item.title} on ${day.date}`}
                        >
                          <span className="schedule-grid__cell-badge">{hours.toFixed(1)}h</span>
                        </button>
                      ) : <span className="schedule-grid__cell-badge">{hours.toFixed(1)}h</span>;
                    }
                    const { assignedPersonHours, remainingAtStart, deficit } = lastDayBreakdown;
                    const isDeficit = deficit != null;
                    const isOverCell = !isDeficit && assignedPersonHours > remainingAtStart + 0.01;
                    const badge = (
                      <span className={`schedule-grid__cell-badge${isDeficit ? ' schedule-grid__cell-badge--need' : isOverCell ? ' schedule-grid__cell-badge--over' : ''}`}>
                        {assignedPersonHours.toFixed(1)}h / {remainingAtStart.toFixed(1)}h
                      </span>
                    );
                    return onPersonHoursForDateChange && !isCellDisabled ? (
                      <button
                        type="button"
                        className="schedule-grid__cell-hours-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingDate(day.date);
                          setPersonHoursDraft(String(assignedPersonHours));
                        }}
                        aria-label={`Edit planned hours for ${item.title} on ${day.date}`}
                      >
                        {badge}
                      </button>
                    ) : badge;
                  })()}
                  {day.isWorkDay && (
                    <div className="schedule-grid__cell-crew">
                      {isOverWorker ? (
                        <WarningIcon className="schedule-grid__cell-icon schedule-grid__cell-icon--warning" aria-label="Under planned effort" />
                      ) : (
                        <PeopleIcon className="schedule-grid__cell-icon" aria-hidden />
                      )}
                      <span className="schedule-grid__cell-crew-value">{crewValue.toFixed(2).replace(/\.?0+$/, '')}</span>
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

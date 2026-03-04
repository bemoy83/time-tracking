import { useCallback, useMemo, useRef, useState } from 'react';
import { getEffectiveCrewForDate, type PlanLineItem, type WorkCalendarDay } from '../../../lib/planning/plan-model';
import { BUILD_PHASE_LABELS, BUILD_PHASES, WORK_UNIT_LABELS, type BuildPhase } from '../../../lib/types';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { getAssignedDates } from '../../../lib/planning/scheduling/assignment';
import {
  type PhaseDateValues,
  getPhaseRange,
  hasCompletePhaseDates,
  isDateWithinSpan,
} from './schedule-date-ui';

/**
 * Compute work hours this line item contributes to a specific day (sequential fill).
 * Returns 0 when not assigned or day has no capacity.
 */
function getWorkHoursForDay(
  item: PlanLineItem,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
): number {
  const assignedDates = getAssignedDates(item);
  if (!assignedDates.includes(date)) return 0;
  const totalPersonHours = item.timeHours * item.crew;
  let remaining = totalPersonHours;
  for (const d of assignedDates) {
    const day = dayByDate.get(d);
    const accessH = day?.accessHours ?? 0;
    if (accessH <= 0) continue;
    const crew = getEffectiveCrewForDate(item, d);
    const capacity = crew * accessH;
    const work = Math.min(remaining, capacity);
    if (d === date) return Math.round(work * 10) / 10;
    remaining -= work;
  }
  return 0;
}

/**
 * Compute scheduled person-hours for a line item: sum of crew × accessHours
 * for each assigned work day. Counts all allocated capacity, not capped at estimate.
 * Returns 0 when no assignments.
 */
function getScheduledHours(
  item: PlanLineItem,
  assignedDates: string[],
  dayByDate: Map<string, { accessHours: number }>,
): number {
  if (assignedDates.length === 0) return 0;
  let total = 0;
  for (const date of assignedDates) {
    const day = dayByDate.get(date);
    const accessH = day?.accessHours ?? 0;
    if (accessH <= 0) continue;
    const crew = getEffectiveCrewForDate(item, date);
    total += crew * accessH;
  }
  return Math.round(total * 10) / 10;
}
import { PeopleIcon, ChevronIcon, WarningIcon } from '../../../components/icons';

/**
 * On the item's last assigned day with crew, returns { assignedPersonHours, remainingAtStart, deficit? } —
 * assigned person-hours this day (crew × accessHours, not capped) and estimate remaining at start.
 * remainingAtStart = amount still needed at start of this day (same for over or under).
 * deficit = amount still needed after this day, when over-worker.
 */
function getLastDayBreakdown(
  item: PlanLineItem,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
): { assignedPersonHours: number; remainingAtStart: number; deficit?: number } | null {
  const assignedDates = getAssignedDates(item);
  if (assignedDates.length === 0) return null;
  if (assignedDates[assignedDates.length - 1] !== date) return null;

  const day = dayByDate.get(date);
  const accessH = day?.accessHours ?? 0;
  if (accessH <= 0) return null;
  const crew = getEffectiveCrewForDate(item, date);
  const assignedPersonHours = Math.round(crew * accessH * 10) / 10;
  if (assignedPersonHours <= 0) return null;

  const totalPersonHours = item.timeHours * item.crew;
  let remaining = totalPersonHours;
  let remainingAtStart = 0;

  for (const d of assignedDates) {
    const dDay = dayByDate.get(d);
    const dAccessH = dDay?.accessHours ?? 0;
    if (dAccessH <= 0) continue;
    const dCrew = getEffectiveCrewForDate(item, d);
    const capacity = dCrew * dAccessH;
    if (d === date) remainingAtStart = remaining;
    remaining -= Math.min(remaining, capacity);
  }

  const result: { assignedPersonHours: number; remainingAtStart: number; deficit?: number } = {
    assignedPersonHours,
    remainingAtStart: Math.round(remainingAtStart * 10) / 10,
  };
  if (remaining > 0.01) result.deficit = Math.round(remaining * 10) / 10;
  return result;
}

/** For isOverWorker check: true when last day has deficit. */
function isOverWorkerForDay(
  item: PlanLineItem,
  date: string,
  dayByDate: Map<string, { accessHours: number }>,
): boolean {
  const b = getLastDayBreakdown(item, date, dayByDate);
  return b != null && b.deficit != null;
}

interface ScheduleGridProps {
  lineItems: PlanLineItem[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDates: PhaseDateValues;
  readOnly: boolean;
  onAutoSchedule?: () => void;
  onToggleAssignment: (lineItem: PlanLineItem, date: string, cellElement?: HTMLElement) => void;
  onCrewForDateChange?: (lineItemId: string, date: string, crew: number) => void;
}

function formatDayLabel(date: string, index: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  const formatted = parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `Day ${index + 1} | ${formatted}`;
}

function formatUtilBadge(
  cap: {
    requiredPersonHours: number;
    availablePersonHours: number;
    assignedCrewTotal: number;
    accessHours: number;
    isOverWorkerCapacity: boolean;
    isOverStaffed: boolean;
    assignedCapacityPersonHours: number;
    isCompletionDay: boolean;
    needToMeetTargetPersonHours?: number;
  },
): string {
  const required = cap.requiredPersonHours;
  const available = cap.availablePersonHours;

  if (available <= 0) return `${required.toFixed(0)}h`;
  return `${required.toFixed(0)} / ${available.toFixed(0)}h`;
}

interface PhaseGroup {
  phase: BuildPhase;
  label: string;
  items: PlanLineItem[];
}

function groupByPhase(lineItems: PlanLineItem[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const phase of BUILD_PHASES) {
    const items = lineItems.filter((item) => item.buildPhase === phase);
    if (items.length > 0) {
      groups.push({ phase, label: BUILD_PHASE_LABELS[phase], items });
    }
  }
  return groups;
}

export function ScheduleGrid({
  lineItems,
  calendar,
  capacity,
  phaseDates,
  readOnly,
  onAutoSchedule,
  onToggleAssignment,
  onCrewForDateChange,
}: ScheduleGridProps) {
  const dayByDate = new Map(capacity.days.map((day) => [day.date, day]));
  const hasPhaseWindows = hasCompletePhaseDates(phaseDates);
  const unscheduled = lineItems.filter((item) => item.scheduledStart == null || item.scheduledEnd == null);
  const phaseGroups = useMemo(() => groupByPhase(lineItems), [lineItems]);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<BuildPhase>>(new Set());

  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(220px, 1.3fr) repeat(${calendar.length}, minmax(144px, 1fr))`;

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('schedule-grid__cell')) return;
    const cells = gridRef.current?.querySelectorAll<HTMLButtonElement>('.schedule-grid__cell');
    if (!cells) return;

    const cellArray = Array.from(cells);
    const currentIndex = cellArray.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) return;

    const colCount = calendar.length;
    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowDown':
        nextIndex = currentIndex + colCount;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex - colCount;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        target.click();
        return;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < cellArray.length) {
      e.preventDefault();
      cellArray[nextIndex].focus();
    }
  }, [calendar.length]);

  const togglePhase = (phase: BuildPhase) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const renderRow = (item: PlanLineItem, rowIndex: number) => {
    const assignedDates = getAssignedDates(item);
    const assigned = new Set(assignedDates);
    const phaseRange = hasPhaseWindows ? getPhaseRange(phaseDates, item.buildPhase) : null;
    const hasAssignments = assigned.size > 0;
    const estimateHours = item.timeHours * item.crew;
    const scheduledHours = hasAssignments ? getScheduledHours(item, assignedDates, dayByDate) : 0;
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
    return (
      <div key={item.id}>
        <div className={`schedule-grid__row${rowStatusClass ? ` ${rowStatusClass}` : ''}`} role="row" aria-rowindex={rowIndex + 2} style={{ gridTemplateColumns: gridColumns }}>
          <div className="schedule-grid__line-item" role="rowheader">
            <span className="schedule-grid__line-item-title">{item.title}</span>
            <span className="schedule-grid__line-item-meta">
              {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]} ·{' '}
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
            const isOverWorker = isAssigned && isOverWorkerForDay(item, day.date, dayByDate);
            const crewValue = isAssigned && day.isWorkDay ? (item.crewByDate?.[day.date] ?? item.crew) : 0;
            const lastDayBd = isAssigned ? getLastDayBreakdown(item, day.date, dayByDate) : null;
            const OVER_TARGET_TOLERANCE = 1.05;
            const isOverTargetCell =
              lastDayBd != null &&
              lastDayBd.deficit == null &&
              lastDayBd.remainingAtStart > 0 &&
              lastDayBd.assignedPersonHours > lastDayBd.remainingAtStart * OVER_TARGET_TOLERANCE;
            const isTargetMet =
              isAssigned && isOnTarget && !isOver && !isOverCrew && !isOverWorker && !isOverTargetCell;

            return (
              <button
                key={`${item.id}:${day.date}`}
                type="button"
                role="gridcell"
                aria-colindex={colIdx + 2}
                className={`schedule-grid__cell${isAssigned ? ' schedule-grid__cell--assigned' : ''}${isTargetMet ? ' schedule-grid__cell--on-target' : ''}${isOverTargetCell ? ' schedule-grid__cell--over-target' : ''}${day.isWorkDay ? '' : ' schedule-grid__cell--off'}${isOutOfPhase ? ' schedule-grid__cell--phase-locked' : ''}${isPhaseMismatch ? ' schedule-grid__cell--phase-mismatch' : ''}${isOver && isAssigned ? ' schedule-grid__cell--over' : ''}${isOverCrew && isAssigned ? ' schedule-grid__cell--over-crew' : ''}${isOverWorker ? ' schedule-grid__cell--over-worker' : ''}`}
                onClick={(e) => {
                  // Don't toggle when clicking − or + buttons (they adjust crew)
                  if ((e.target as HTMLElement).closest('.schedule-grid__cell-crew-btn')) return;
                  onToggleAssignment(item, day.date, e.currentTarget);
                }}
                disabled={readOnly || !day.isWorkDay || isOutOfPhase}
                title={
                  isOutOfPhase
                    ? `Outside ${BUILD_PHASE_LABELS[item.buildPhase]} window`
                    : isOverWorker
                      ? 'Exceeds worker capacity (add crew or days)'
                      : isAssigned
                        ? 'Click to unassign'
                        : 'Click to assign'
                }
                aria-label={
                  isOutOfPhase
                    ? `${item.title} on ${day.date} is outside ${BUILD_PHASE_LABELS[item.buildPhase]} window`
                    : `Toggle ${item.title} on ${day.date}`
                }
              >
                {isAssigned ? (
                  <>
                    {(() => {
                      const hours = getWorkHoursForDay(item, day.date, dayByDate);
                      if (hours <= 0) return null;
                      const lastDayBreakdown = getLastDayBreakdown(item, day.date, dayByDate);
                      if (lastDayBreakdown == null) {
                        return <span className="schedule-grid__cell-badge">{hours.toFixed(1)}h</span>;
                      }
                      const { assignedPersonHours, remainingAtStart, deficit } = lastDayBreakdown;
                      const isDeficit = deficit != null;
                      const isOver = !isDeficit && assignedPersonHours > remainingAtStart + 0.01;
                      return (
                        <span className={`schedule-grid__cell-badge${isDeficit ? ' schedule-grid__cell-badge--need' : isOver ? ' schedule-grid__cell-badge--over' : ''}`}>
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
                                if (crewValue > 0) onCrewForDateChange(item.id, day.date, crewValue - 1);
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
                                if (crewValue < 99) onCrewForDateChange(item.id, day.date, crewValue + 1);
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
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="schedule-view__block" aria-labelledby="schedule-grid-title">
      <header className="schedule-view__block-header" id="schedule-grid-title">
        <h3 className="schedule-view__block-title">
          Schedule Grid
          {unscheduled.length > 0 && (
            <span className="schedule-grid__unscheduled-badge">
              {unscheduled.length} unscheduled
            </span>
          )}
        </h3>
      </header>

      {calendar.length === 0 ? (
        <p className="schedule-view__muted">Set schedule dates to open the schedule grid.</p>
      ) : (
        <div
          className="schedule-grid"
          ref={gridRef}
          onKeyDown={handleGridKeyDown}
          role="grid"
          aria-label="Schedule grid"
          style={{ '--schedule-day-count': calendar.length } as React.CSSProperties}
        >
          <div className="schedule-grid__header" role="row" style={{ gridTemplateColumns: gridColumns }}>
            <div className="schedule-grid__line-item-col schedule-grid__line-item-col--with-action" role="columnheader">
              <span className="schedule-grid__line-item-col-label">Work package</span>
              {onAutoSchedule && calendar.length > 0 && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm schedule-grid__auto-schedule-btn"
                  onClick={onAutoSchedule}
                  disabled={readOnly || unscheduled.length === 0}
                  aria-label={unscheduled.length > 0 ? `Auto-schedule ${unscheduled.length} unscheduled item${unscheduled.length === 1 ? '' : 's'}` : 'No unscheduled items'}
                >
                  Auto-schedule ({unscheduled.length})
                </button>
              )}
            </div>
            {calendar.map((day, index) => {
              const cap = dayByDate.get(day.date);
              const isOver = cap?.isOverAllocated ?? false;
              return (
                <span
                  key={day.date}
                  role="columnheader"
                  className={`schedule-grid__day-col${day.isWorkDay ? '' : ' schedule-grid__day-col--off'}${isOver ? ' schedule-grid__day-col--over' : ''}${cap?.isOverAssignedCrew ? ' schedule-grid__day-col--over-crew' : ''}${cap?.isOverWorkerCapacity ? ' schedule-grid__day-col--over-worker' : ''}${cap?.isOverStaffed ? ' schedule-grid__day-col--over-staffed' : ''}`}
                >
                  <span className="schedule-grid__day-label">{formatDayLabel(day.date, index)}</span>
                  {cap && day.isWorkDay && (
                    <>
                      {cap.availablePersonHours > 0 && (() => {
                        const pct = Math.round((cap.requiredPersonHours / cap.availablePersonHours) * 100);
                        const barWidth = Math.min(pct, 100);
                        return (
                          <span
                            className="schedule-grid__day-bar"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${pct}% capacity used`}
                          >
                            <span
                              className={`schedule-grid__day-bar-fill${cap.isOverAllocated ? ' schedule-grid__day-bar-fill--over' : ''}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </span>
                        );
                      })()}
                      <span className={`schedule-grid__day-util${isOver ? ' schedule-grid__day-util--over' : ''}${cap.isOverWorkerCapacity ? ' schedule-grid__day-util--over-worker' : ''}${cap.isOverStaffed ? ' schedule-grid__day-util--over-staffed' : ''}`}>
                        {formatUtilBadge(cap)}
                      </span>
                      {cap.assignedCrewTotal > 0 && (
                        <span className={`schedule-grid__day-crew${cap.isOverAssignedCrew ? ' schedule-grid__day-crew--over' : ''}`}>
                          {cap.assignedCrewTotal}/{cap.availableCrew} crew
                        </span>
                      )}
                    </>
                  )}
                </span>
              );
            })}
          </div>

          <div className="schedule-grid__body">
            {phaseGroups.length > 1
              ? (() => {
                  let globalRowIdx = 0;
                  return phaseGroups.map((group) => {
                    const isCollapsed = collapsedPhases.has(group.phase);
                    const startIdx = globalRowIdx;
                    globalRowIdx += group.items.length;
                    return (
                      <div key={group.phase} className="schedule-grid__phase-group">
                        <button
                          type="button"
                          className="schedule-grid__phase-header"
                          onClick={() => togglePhase(group.phase)}
                          aria-expanded={!isCollapsed}
                          style={{ gridTemplateColumns: gridColumns }}
                        >
                          <span className="schedule-grid__phase-label">
                            <ChevronIcon
                              className={`schedule-grid__phase-chevron${!isCollapsed ? ' schedule-grid__phase-chevron--expanded' : ''}`}
                            />
                            {group.label} ({group.items.length})
                          </span>
                          {calendar.map((day) => (
                            <span key={day.date} className="schedule-grid__phase-spacer" aria-hidden="true" />
                          ))}
                        </button>
                        {!isCollapsed && group.items.map((item, i) => renderRow(item, startIdx + i))}
                      </div>
                    );
                  });
                })()
              : lineItems.map((item, i) => renderRow(item, i))
            }
          </div>
        </div>
      )}

    </section>
  );
}

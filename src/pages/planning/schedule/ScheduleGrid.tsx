import { useCallback, useMemo, useRef, useState } from 'react';
import type { PlanLineItem, WorkCalendarDay } from '../../../lib/planning/plan-model';
import { BUILD_PHASE_LABELS, BUILD_PHASES, WORK_UNIT_LABELS, type BuildPhase } from '../../../lib/types';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { getAssignedDates } from '../../../lib/planning/scheduling/assignment';
import { CheckIcon, ChevronIcon, WarningIcon } from '../../../components/icons';

interface ScheduleGridProps {
  lineItems: PlanLineItem[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  readOnly: boolean;
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
  required: number,
  available: number,
  overWorker?: { assignedCrewTotal: number; accessHours: number },
): string {
  if (overWorker) {
    const maxAchievable = overWorker.assignedCrewTotal * overWorker.accessHours;
    return `${required.toFixed(0)}h / ${maxAchievable.toFixed(0)}h max`;
  }
  if (available <= 0) return `${required.toFixed(0)}h`;
  const pct = Math.round((required / available) * 100);
  return `${required.toFixed(0)}h ${pct}%`;
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
  readOnly,
  onToggleAssignment,
  onCrewForDateChange,
}: ScheduleGridProps) {
  const dayByDate = new Map(capacity.days.map((day) => [day.date, day]));
  const unscheduled = lineItems.filter((item) => item.scheduledStart == null || item.scheduledEnd == null);
  const phaseGroups = useMemo(() => groupByPhase(lineItems), [lineItems]);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<BuildPhase>>(new Set());
  const [expandedCrewItemId, setExpandedCrewItemId] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(220px, 1.3fr) repeat(${calendar.length}, minmax(72px, 1fr))`;

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
    const assigned = new Set(getAssignedDates(item));
    const isCrewExpanded = expandedCrewItemId === item.id;
    const hasAssignments = assigned.size > 0;
    return (
      <div key={item.id}>
        <div className="schedule-grid__row" role="row" aria-rowindex={rowIndex + 2} style={{ gridTemplateColumns: gridColumns }}>
          <div className="schedule-grid__line-item" role="rowheader">
            <span className="schedule-grid__line-item-title">{item.title}</span>
            <span className="schedule-grid__line-item-meta">
              {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]} · {(item.timeHours * item.crew).toFixed(1)}h
              {hasAssignments && !readOnly && onCrewForDateChange && (
                <button
                  type="button"
                  className="schedule-grid__crew-toggle"
                  onClick={() => setExpandedCrewItemId(isCrewExpanded ? null : item.id)}
                  aria-expanded={isCrewExpanded}
                  title="Edit crew per day"
                >
                  {isCrewExpanded ? 'Hide crew' : 'Crew/day'}
                </button>
              )}
            </span>
          </div>
          {calendar.map((day, colIdx) => {
            const isAssigned = assigned.has(day.date);
            const cap = dayByDate.get(day.date);
            const isOver = cap?.isOverAllocated ?? false;
            const isOverCrew = cap?.isOverAssignedCrew ?? false;
            const isOverWorker = (cap?.isOverWorkerCapacity ?? false) && isAssigned;
            return (
              <button
                key={`${item.id}:${day.date}`}
                type="button"
                role="gridcell"
                aria-colindex={colIdx + 2}
                className={`schedule-grid__cell${isAssigned ? ' schedule-grid__cell--assigned' : ''}${day.isWorkDay ? '' : ' schedule-grid__cell--off'}${isOver && isAssigned ? ' schedule-grid__cell--over' : ''}${isOverCrew && isAssigned ? ' schedule-grid__cell--over-crew' : ''}${isOverWorker ? ' schedule-grid__cell--over-worker' : ''}`}
                onClick={(e) => onToggleAssignment(item, day.date, e.currentTarget)}
                disabled={readOnly || !day.isWorkDay}
                title={isOverWorker ? 'Exceeds worker capacity (add crew or days)' : isAssigned ? 'Click to unassign' : 'Click to assign'}
                aria-label={`Toggle ${item.title} on ${day.date}`}
              >
                {isAssigned ? (
                  isOverWorker ? (
                    <WarningIcon className="schedule-grid__cell-icon" aria-label="Exceeds worker capacity" />
                  ) : (
                    <CheckIcon className="schedule-grid__cell-icon" />
                  )
                ) : null}
              </button>
            );
          })}
        </div>
        {isCrewExpanded && onCrewForDateChange && (
          <div className="schedule-grid__crew-row" style={{ gridTemplateColumns: gridColumns }}>
            <span className="schedule-grid__crew-label">Crew/day</span>
            {calendar.map((day) => {
              const isAssigned = assigned.has(day.date);
              if (!isAssigned || !day.isWorkDay) {
                return <span key={`crew-${item.id}:${day.date}`} className="schedule-grid__crew-cell schedule-grid__crew-cell--empty" />;
              }
              const crewValue = item.crewByDate?.[day.date] ?? item.crew;
              return (
                <input
                  key={`crew-${item.id}:${day.date}`}
                  type="number"
                  className="schedule-grid__crew-input"
                  value={crewValue}
                  min={0}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (Number.isFinite(v)) onCrewForDateChange(item.id, day.date, v);
                  }}
                  aria-label={`Crew for ${item.title} on ${day.date}`}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="schedule-view__block" role="grid" aria-label="Schedule grid">
      <header className="schedule-view__block-header">
        <h3 className="schedule-view__block-title">Schedule Grid</h3>
      </header>

      {calendar.length === 0 ? (
        <p className="schedule-view__muted">Set event start and end dates to open the schedule grid.</p>
      ) : (
        <div className="schedule-grid" ref={gridRef} onKeyDown={handleGridKeyDown}>
          <div className="schedule-grid__header" role="row" style={{ gridTemplateColumns: gridColumns }}>
            <span className="schedule-grid__line-item-col" role="columnheader">Work package</span>
            {calendar.map((day, index) => {
              const cap = dayByDate.get(day.date);
              const isOver = cap?.isOverAllocated ?? false;
              return (
                <span
                  key={day.date}
                  role="columnheader"
                  className={`schedule-grid__day-col${day.isWorkDay ? '' : ' schedule-grid__day-col--off'}${isOver ? ' schedule-grid__day-col--over' : ''}${cap?.isOverAssignedCrew ? ' schedule-grid__day-col--over-crew' : ''}${cap?.isOverWorkerCapacity ? ' schedule-grid__day-col--over-worker' : ''}`}
                >
                  <span className="schedule-grid__day-label">{formatDayLabel(day.date, index)}</span>
                  {cap && day.isWorkDay && (
                    <>
                      <span className={`schedule-grid__day-util${isOver ? ' schedule-grid__day-util--over' : ''}${cap.isOverWorkerCapacity ? ' schedule-grid__day-util--over-worker' : ''}`}>
                        {formatUtilBadge(
                          cap.requiredPersonHours,
                          cap.availablePersonHours,
                          cap.isOverWorkerCapacity
                            ? { assignedCrewTotal: cap.assignedCrewTotal, accessHours: cap.accessHours }
                            : undefined,
                        )}
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
                        </button>
                        {!isCollapsed && group.items.map((item, i) => renderRow(item, startIdx + i))}
                      </div>
                    );
                  });
                })()
              : lineItems.map((item, i) => renderRow(item, i))
            }
          </div>

          <div className="schedule-grid__footer" role="row" style={{ gridTemplateColumns: gridColumns }}>
            <span className="schedule-grid__line-item-col" role="columnheader">Utilization</span>
            {calendar.map((day) => {
              const cap = dayByDate.get(day.date);
              if (!cap) return <span key={`${day.date}-empty`} className="schedule-grid__summary-col">-</span>;
              const pct = cap.utilization != null ? Math.round(cap.utilization * 100) : 0;
              const barWidth = Math.min(pct, 100);
              return (
                <span
                  key={`${day.date}-summary`}
                  className={`schedule-grid__summary-col${cap.isOverAllocated ? ' schedule-grid__summary-col--over' : ''}`}
                >
                  <span>{cap.requiredPersonHours.toFixed(1)} / {cap.availablePersonHours.toFixed(1)}h</span>
                  <span
                    className="schedule-grid__util-bar"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pct}% utilized`}
                  >
                    <span
                      className={`schedule-grid__util-bar-fill${cap.isOverAllocated ? ' schedule-grid__util-bar-fill--over' : ''}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="schedule-view__unscheduled">
        <h4 className="schedule-view__unscheduled-title">Unscheduled ({unscheduled.length})</h4>
        {unscheduled.length === 0 ? (
          <p className="schedule-view__muted">All work packages are placed.</p>
        ) : (
          <ul className="schedule-view__unscheduled-list">
            {unscheduled.map((item) => (
              <li key={item.id}>
                {item.title}
                <span className="schedule-view__unscheduled-hours"> — {(item.timeHours * item.crew).toFixed(1)}h</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

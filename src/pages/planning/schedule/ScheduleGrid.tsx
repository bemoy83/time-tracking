import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronIcon } from '../../../components/icons';
import type { PlanLineItem, WorkCalendarDay } from '../../../lib/planning/plan-model';
import { getPhaseFields, isPhaseActive } from '../../../lib/planning/plan-model';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { getAssignedDates } from '../../../lib/planning/scheduling/assignment';
import { computeSharedRowAggregates } from '../../../lib/planning/scheduling/shared-row-aggregates';
import { resolveRequiredPersonHoursForPhase } from '../../../lib/planning/scheduling/auto-schedule';
import {
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  type BuildPhase,
} from '../../../lib/types';
import type {
  SharedScheduleRow,
} from '../../../lib/planning/scheduling/shared-schedule-types';
import {
  type PhaseDateValues,
  getPhaseRange,
  hasCompletePhaseDates,
} from './schedule-date-ui';
import { ScheduleGridGroupRow } from './grid/ScheduleGridGroupRow';
import { ScheduleGridHeader } from './grid/ScheduleGridHeader';
import { ScheduleGridItemRow } from './grid/ScheduleGridItemRow';
import { getAssignedDatesWithinPhase } from './grid/schedule-grid-metrics';

interface PhaseGroup {
  phase: BuildPhase;
  label: string;
  rows: Array<{ item: PlanLineItem; phase: BuildPhase }>;
}

function groupByPhase(lineItems: PlanLineItem[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const phase of BUILD_PHASES) {
    const rows = lineItems
      .filter((item) => isPhaseActive(item, phase))
      .map((item) => ({ item, phase }));
    if (rows.length > 0) {
      groups.push({ phase, label: BUILD_PHASE_LABELS[phase], rows });
    }
  }
  return groups;
}

interface SingleScheduleGridProps {
  mode?: 'single';
  lineItems: PlanLineItem[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDates: PhaseDateValues;
  readOnly: boolean;
  onAutoSchedule?: () => void;
  onToggleAssignment: (lineItem: PlanLineItem, phase: BuildPhase, date: string, cellElement?: HTMLElement) => void;
  onCrewForDateChange?: (lineItemId: string, phase: BuildPhase, date: string, crew: number) => void;
}

interface SharedScheduleGridProps {
  mode: 'shared';
  rows: SharedScheduleRow[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDatesByPlanId: Map<string, PhaseDateValues>;
  planTitleByPlanId: Map<string, string>;
  projectNameByPlanId: Map<string, string>;
  itemByCompositeId: Map<string, PlanLineItem>;
  onToggleAssignment: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    cellElement?: HTMLElement,
  ) => void;
  onCrewForDateChange?: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    crew: number,
  ) => void;
}

type ScheduleGridProps = SingleScheduleGridProps | SharedScheduleGridProps;

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

interface PhaseRowCandidate {
  item: PlanLineItem;
  phase: BuildPhase;
}

export function getSchedulableUnscheduledPhaseRowCount(
  lineItems: PlanLineItem[],
  phaseDates: PhaseDateValues,
  workDays: WorkCalendarDay[],
): number {
  const phaseRows: PhaseRowCandidate[] = [];
  for (const item of lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      phaseRows.push({ item, phase });
    }
  }

  return phaseRows.filter(({ item, phase }) => {
    const pf = getPhaseFields(item, phase);
    if (pf.scheduledStart != null && pf.scheduledEnd != null) return false;

    const requiredPH = resolveRequiredPersonHoursForPhase(item, phase, 'time_hours_first');
    if (requiredPH == null || requiredPH <= 0) return false;

    const phaseRange = getPhaseRange(phaseDates, phase);
    if (!phaseRange) return workDays.length > 0;

    return workDays.some(
      (day) => day.date >= phaseRange.start && day.date <= phaseRange.end,
    );
  }).length;
}

function getUnscheduledPhaseRowCount(lineItems: PlanLineItem[]): number {
  let count = 0;
  for (const item of lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      if (pf.scheduledStart == null || pf.scheduledEnd == null) count += 1;
    }
  }
  return count;
}

function SingleScheduleGrid({
  lineItems,
  calendar,
  capacity,
  phaseDates,
  readOnly,
  onAutoSchedule,
  onToggleAssignment,
  onCrewForDateChange,
}: SingleScheduleGridProps) {
  const dayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, day])),
    [capacity.days],
  );
  const hasPhaseWindows = hasCompletePhaseDates(phaseDates);
  const workDays = useMemo(() => calendar.filter((d) => d.isWorkDay), [calendar]);
  const unscheduledCount = useMemo(
    () => getUnscheduledPhaseRowCount(lineItems),
    [lineItems],
  );
  const schedulableUnscheduledCount = useMemo(
    () => getSchedulableUnscheduledPhaseRowCount(lineItems, phaseDates, workDays),
    [lineItems, phaseDates, workDays],
  );
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

  const renderRow = (item: PlanLineItem, phase: BuildPhase, rowIndex: number) => {
    const pf = getPhaseFields(item, phase);
    const assignedDates = getAssignedDates(pf);
    const phaseRange = hasPhaseWindows ? getPhaseRange(phaseDates, phase) : null;

    return (
      <ScheduleGridItemRow
        key={`${item.id}:${phase}`}
        rowIndex={rowIndex}
        item={item}
        phase={phase}
        assignedDates={assignedDates}
        calendar={calendar}
        dayByDate={dayByDate}
        gridColumns={gridColumns}
        phaseRange={phaseRange}
        hasPhaseWindows={hasPhaseWindows}
        readOnly={readOnly}
        onToggleAssignment={(date, cellElement) => onToggleAssignment(item, phase, date, cellElement)}
        onCrewForDateChange={onCrewForDateChange ? (date, crew) => onCrewForDateChange(item.id, phase, date, crew) : undefined}
        outOfPhaseAriaUsesLabel
      />
    );
  };

  return (
    <section className="schedule-view__block" aria-labelledby="schedule-grid-title">
      <header className="schedule-view__block-header" id="schedule-grid-title">
        <h3 className="schedule-view__block-title">
          Schedule Grid
          {unscheduledCount > 0 && (
            <span className="schedule-grid__unscheduled-badge">
              {unscheduledCount} unscheduled
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
          <ScheduleGridHeader
            calendar={calendar}
            dayByDate={dayByDate}
            gridColumns={gridColumns}
            label="Work package"
            onAutoSchedule={onAutoSchedule}
            unscheduledCount={schedulableUnscheduledCount}
            readOnly={readOnly}
            hasWorkDays={workDays.length > 0}
          />

          <div className="schedule-grid__body">
            {phaseGroups.length > 1
              ? (() => {
                  let globalRowIdx = 0;
                  return phaseGroups.map((group) => {
                    const isCollapsed = collapsedPhases.has(group.phase);
                    const startIdx = globalRowIdx;
                    globalRowIdx += group.rows.length;
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
                            <ChevronIcon className={`schedule-grid__phase-chevron${!isCollapsed ? ' schedule-grid__phase-chevron--expanded' : ''}`} />
                            {group.label} ({group.rows.length})
                          </span>
                          {calendar.map((day) => (
                            <span key={day.date} className="schedule-grid__phase-spacer" aria-hidden="true" />
                          ))}
                        </button>
                        {!isCollapsed && group.rows.map(({ item, phase }, i) => renderRow(item, phase, startIdx + i))}
                      </div>
                    );
                  });
                })()
              : phaseGroups.length === 1
                ? phaseGroups[0].rows.map(({ item, phase }, i) => renderRow(item, phase, i))
                : lineItems.map((item, i) => {
                    // Fallback: render for each active phase
                    const activePhase = BUILD_PHASES.find((p) => isPhaseActive(item, p)) ?? 'build-up';
                    return renderRow(item, activePhase, i);
                  })
            }
          </div>
        </div>
      )}
    </section>
  );
}

function SharedScheduleGrid({
  rows,
  calendar,
  capacity,
  phaseDatesByPlanId,
  planTitleByPlanId,
  projectNameByPlanId,
  itemByCompositeId,
  onToggleAssignment,
  onCrewForDateChange,
}: SharedScheduleGridProps) {
  const dayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, day])),
    [capacity.days],
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(280px, 1.6fr) repeat(${calendar.length}, minmax(144px, 1fr))`;
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  const projectPhaseIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      if (row.type !== 'phase') continue;
      const existing = map.get(row.projectRowId) ?? [];
      existing.push(row.phaseRowId);
      map.set(row.projectRowId, existing);
    }
    return map;
  }, [rows]);

  const rowAggregatesByDate = useMemo(
    () => computeSharedRowAggregates({
      rows,
      calendar,
      itemByCompositeId,
      phaseDatesByPlanId,
      dayByDate,
    }),
    [rows, calendar, itemByCompositeId, phaseDatesByPlanId, dayByDate],
  );

  const unscheduledCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      if (row.type !== 'item') continue;
      const item = itemByCompositeId.get(mapKey(row.planId, row.lineItemId));
      if (!item) { count += 1; continue; }
      const pf = getPhaseFields(item, row.phase);
      if (!pf.scheduledStart || !pf.scheduledEnd) count += 1;
    }
    return count;
  }, [rows, itemByCompositeId]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (row.type === 'project') return true;
    if (collapsedProjects.has(row.projectRowId)) return false;
    if (row.type === 'phase') return true;
    return !collapsedPhases.has(row.phaseRowId);
  }), [rows, collapsedProjects, collapsedPhases]);

  const toggleProject = (projectRowId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectRowId)) {
        next.delete(projectRowId);
      } else {
        next.add(projectRowId);
      }
      return next;
    });

    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (collapsedProjects.has(projectRowId)) {
        return next;
      }
      const phaseIds = projectPhaseIds.get(projectRowId) ?? [];
      for (const phaseId of phaseIds) {
        next.add(phaseId);
      }
      return next;
    });
  };

  const togglePhase = (phaseRowId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseRowId)) next.delete(phaseRowId);
      else next.add(phaseRowId);
      return next;
    });
  };

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

  return (
    <section className="schedule-view__block" aria-labelledby="schedule-grid-title">
      <header className="schedule-view__block-header" id="schedule-grid-title">
        <h3 className="schedule-view__block-title">
          Shared Schedule Grid
          {unscheduledCount > 0 && (
            <span className="schedule-grid__unscheduled-badge">
              {unscheduledCount} unscheduled
            </span>
          )}
        </h3>
      </header>

      {calendar.length === 0 ? (
        <p className="schedule-view__muted">Configure crew pool dates to open the shared schedule grid.</p>
      ) : (
        <div
          className="schedule-grid"
          ref={gridRef}
          onKeyDown={handleGridKeyDown}
          role="grid"
          aria-label="Shared schedule grid"
          style={{ '--schedule-day-count': calendar.length } as React.CSSProperties}
        >
          <ScheduleGridHeader
            calendar={calendar}
            dayByDate={dayByDate}
            gridColumns={gridColumns}
            label="Shared crew pool"
          />

          <div className="schedule-grid__body">
            {visibleRows.map((row, idx) => {
              if (row.type === 'item') {
                const item = itemByCompositeId.get(mapKey(row.planId, row.lineItemId));
                if (!item) return null;
                const rowPhaseDates = phaseDatesByPlanId.get(row.planId);
                const hasPhaseWindows = rowPhaseDates ? hasCompletePhaseDates(rowPhaseDates) : false;
                const assignedDates = getAssignedDatesWithinPhase(item, row.phase, rowPhaseDates);
                const phaseRange = hasPhaseWindows ? getPhaseRange(rowPhaseDates, row.phase) : null;
                const projectName = projectNameByPlanId.get(row.planId);
                const planTitle = planTitleByPlanId.get(row.planId) ?? row.planId;
                const metaPrefix = `${planTitle}${projectName ? ` (${projectName})` : ''}`;

                return (
                  <ScheduleGridItemRow
                    key={row.id}
                    rowIndex={idx}
                    item={item}
                    phase={row.phase}
                    assignedDates={assignedDates}
                    calendar={calendar}
                    dayByDate={dayByDate}
                    gridColumns={gridColumns}
                    phaseRange={phaseRange}
                    hasPhaseWindows={hasPhaseWindows}
                    readOnly={row.readOnly}
                    metaPrefix={metaPrefix}
                    onToggleAssignment={(date, cellElement) => onToggleAssignment(row.planId, row.lineItemId, row.phase, date, cellElement)}
                    onCrewForDateChange={onCrewForDateChange ? (date, crew) => onCrewForDateChange(row.planId, row.lineItemId, row.phase, date, crew) : undefined}
                    outOfPhaseAriaUsesLabel={false}
                    readOnlyTitle="Read-only (reviewed plan)"
                  />
                );
              }

              const isProject = row.type === 'project';
              const isCollapsed = isProject
                ? collapsedProjects.has(row.id)
                : collapsedPhases.has(row.phaseRowId);

              return (
                <ScheduleGridGroupRow
                  key={row.id}
                  row={row}
                  calendar={calendar}
                  gridColumns={gridColumns}
                  aggregateByDate={rowAggregatesByDate.get(row.id)}
                  isCollapsed={isCollapsed}
                  onToggle={() => {
                    if (isProject) toggleProject(row.id);
                    else togglePhase(row.phaseRowId);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function ScheduleGrid(props: ScheduleGridProps) {
  if (props.mode === 'shared') {
    return <SharedScheduleGrid {...props} />;
  }
  return <SingleScheduleGrid {...props} />;
}

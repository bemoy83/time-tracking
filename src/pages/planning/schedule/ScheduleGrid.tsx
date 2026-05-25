import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ScheduleGridShell,
  useScheduleGridKeyboardNavigation,
} from './grid/ScheduleGridShell';
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
  onClearRowSchedule?: (lineItem: PlanLineItem, phase: BuildPhase) => void;
  onPersonHoursForDateChange?: (lineItemId: string, phase: BuildPhase, date: string, personHours: number) => void;
  unresolvedIssueKeys?: Set<string>;
  activeIssueKey?: string | null;
  onToggleWorkday?: (date: string) => void;
  todayIso?: string;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
}

interface SharedScheduleGridProps {
  mode: 'shared';
  rows: SharedScheduleRow[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDatesByPlanId: Map<string, PhaseDateValues>;
  planDisplayNameByPlanId: Map<string, string>;
  itemByCompositeId: Map<string, PlanLineItem>;
  onAutoSchedule?: () => void;
  onToggleAssignment: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    cellElement?: HTMLElement,
  ) => void;
  onPersonHoursForDateChange?: (
    planId: string,
    lineItemId: string,
    phase: BuildPhase,
    date: string,
    personHours: number,
  ) => void;
}

type ScheduleGridProps = SingleScheduleGridProps | SharedScheduleGridProps;

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function toggleSetValue<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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
    if (getAssignedDates(pf).length > 0) return false;

    const requiredPH = resolveRequiredPersonHoursForPhase(item, phase, 'time_hours_first');
    if (requiredPH == null || requiredPH <= 0) return false;

    const phaseRange = getPhaseRange(phaseDates, phase);
    if (!phaseRange) return workDays.length > 0;

    return workDays.some(
      (day) => day.date >= phaseRange.start && day.date <= phaseRange.end,
    );
  }).length;
}

export function getSharedSchedulableUnscheduledCount(
  rows: SharedScheduleRow[],
  calendar: WorkCalendarDay[],
  phaseDatesByPlanId: Map<string, PhaseDateValues>,
  itemByCompositeId: Map<string, PlanLineItem>,
): number {
  const workDays = calendar.filter((d) => d.isWorkDay);
  let count = 0;

  for (const row of rows) {
    if (row.type !== 'item') continue;
    const item = itemByCompositeId.get(mapKey(row.planId, row.lineItemId));
    if (!item) continue;

    const pf = getPhaseFields(item, row.phase);
    if (getAssignedDates(pf).length > 0) continue;

    const requiredPH = resolveRequiredPersonHoursForPhase(item, row.phase, 'time_hours_first');
    if (requiredPH == null || requiredPH <= 0) continue;

    const rowPhaseDates = phaseDatesByPlanId.get(row.planId);
    const phaseRange = rowPhaseDates ? getPhaseRange(rowPhaseDates, row.phase) : null;
    if (!phaseRange) {
      if (workDays.length > 0) count += 1;
      continue;
    }

    if (workDays.some((day) => day.date >= phaseRange.start && day.date <= phaseRange.end)) {
      count += 1;
    }
  }

  return count;
}

function getUnscheduledPhaseRowCount(lineItems: PlanLineItem[]): number {
  let count = 0;
  for (const item of lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      if (getAssignedDates(pf).length === 0) count += 1;
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
  onClearRowSchedule,
  onPersonHoursForDateChange,
  unresolvedIssueKeys,
  activeIssueKey,
  onToggleWorkday,
  todayIso,
  eventStartDate,
  eventEndDate,
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
  const unresolvedKeys = unresolvedIssueKeys ?? new Set<string>();

  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(260px, 1.35fr) repeat(${calendar.length}, minmax(144px, 1fr))`;
  const handleGridKeyboard = useScheduleGridKeyboardNavigation(calendar.length);

  useEffect(() => {
    if (!activeIssueKey) return;
    const phase = activeIssueKey.split(':').slice(-1)[0] as BuildPhase;
    if (!BUILD_PHASES.includes(phase)) return;
    setCollapsedPhases((prev) => {
      if (!prev.has(phase)) return prev;
      const next = new Set(prev);
      next.delete(phase);
      return next;
    });
  }, [activeIssueKey]);

  useEffect(() => {
    if (!activeIssueKey) return;
    const frame = requestAnimationFrame(() => {
      const row = gridRef.current?.querySelector<HTMLElement>(`[data-row-key="${activeIssueKey}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIssueKey]);

  const togglePhase = (phase: BuildPhase) => {
    setCollapsedPhases((prev) => toggleSetValue(prev, phase));
  };

  const renderRow = (item: PlanLineItem, phase: BuildPhase, rowIndex: number) => {
    const rowKey = `${item.id}:${phase}`;
    const pf = getPhaseFields(item, phase);
    const assignedDates = getAssignedDates(pf);
    const phaseRange = hasPhaseWindows ? getPhaseRange(phaseDates, phase) : null;

    return (
      <ScheduleGridItemRow
        key={rowKey}
        rowKey={rowKey}
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
        onClearSchedule={onClearRowSchedule ? () => onClearRowSchedule(item, phase) : undefined}
        onPersonHoursForDateChange={
          onPersonHoursForDateChange
            ? (date, personHours) => onPersonHoursForDateChange(item.id, phase, date, personHours)
            : undefined
        }
        outOfPhaseAriaUsesLabel
        isAssistantUnresolved={unresolvedKeys.has(rowKey)}
        isAssistantActive={activeIssueKey === rowKey}
      />
    );
  };

  return (
    <ScheduleGridShell
      title="Schedule Grid"
      unscheduledCount={unscheduledCount}
      emptyMessage="Set schedule dates to open the schedule grid."
      ariaLabel="Schedule grid"
      calendarLength={calendar.length}
      gridColumns={gridColumns}
      gridRef={gridRef}
      onGridKeyDown={(e) => handleGridKeyboard(gridRef, e)}
      header={(
        <ScheduleGridHeader
          calendar={calendar}
          dayByDate={dayByDate}
          gridColumns={gridColumns}
          label="Work package"
          onAutoSchedule={onAutoSchedule}
          unscheduledCount={schedulableUnscheduledCount}
          readOnly={readOnly}
          hasWorkDays={workDays.length > 0}
          phaseDates={phaseDates}
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
          onToggleWorkday={onToggleWorkday}
          todayIso={todayIso}
        />
      )}
      body={phaseGroups.length > 1
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
                    className={`schedule-grid__phase-header schedule-grid__phase-header--${group.phase}`}
                    onClick={() => togglePhase(group.phase)}
                    aria-expanded={!isCollapsed}
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
              const activePhase = BUILD_PHASES.find((phase) => isPhaseActive(item, phase)) ?? 'assembly';
              return renderRow(item, activePhase, i);
            })}
    />
  );
}

function SharedScheduleGrid({
  rows,
  calendar,
  capacity,
  phaseDatesByPlanId,
  planDisplayNameByPlanId,
  itemByCompositeId,
  onAutoSchedule,
  onToggleAssignment,
  onPersonHoursForDateChange,
}: SharedScheduleGridProps) {
  const dayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, day])),
    [capacity.days],
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(280px, 1.6fr) repeat(${calendar.length}, minmax(144px, 1fr))`;
  const workDays = useMemo(() => calendar.filter((d) => d.isWorkDay), [calendar]);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const handleGridKeyboard = useScheduleGridKeyboardNavigation(calendar.length);

  const schedulableUnscheduledCount = useMemo(
    () => getSharedSchedulableUnscheduledCount(rows, calendar, phaseDatesByPlanId, itemByCompositeId),
    [rows, calendar, phaseDatesByPlanId, itemByCompositeId],
  );

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
      if (getAssignedDates(pf).length === 0) count += 1;
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
      return toggleSetValue(prev, projectRowId);
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
    setCollapsedPhases((prev) => toggleSetValue(prev, phaseRowId));
  };

  return (
    <ScheduleGridShell
      title="Shared Schedule Grid"
      unscheduledCount={unscheduledCount}
      emptyMessage="Configure crew pool dates to open the shared schedule grid."
      ariaLabel="Shared schedule grid"
      calendarLength={calendar.length}
      gridColumns={gridColumns}
      gridRef={gridRef}
      onGridKeyDown={(e) => handleGridKeyboard(gridRef, e)}
      header={(
        <ScheduleGridHeader
          calendar={calendar}
          dayByDate={dayByDate}
          gridColumns={gridColumns}
          label="Shared crew pool"
          onAutoSchedule={onAutoSchedule}
          unscheduledCount={schedulableUnscheduledCount}
          hasWorkDays={workDays.length > 0}
        />
      )}
      body={visibleRows.map((row, idx) => {
        if (row.type === 'item') {
          const item = itemByCompositeId.get(mapKey(row.planId, row.lineItemId));
          if (!item) return null;
          const rowPhaseDates = phaseDatesByPlanId.get(row.planId);
          const hasPhaseWindows = rowPhaseDates ? hasCompletePhaseDates(rowPhaseDates) : false;
          const assignedDates = getAssignedDatesWithinPhase(item, row.phase, rowPhaseDates);
          const phaseRange = hasPhaseWindows ? getPhaseRange(rowPhaseDates, row.phase) : null;
          const metaPrefix = planDisplayNameByPlanId.get(row.planId) ?? row.planId;

          return (
            <ScheduleGridItemRow
              key={row.id}
              rowKey={row.id}
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
              onPersonHoursForDateChange={
                onPersonHoursForDateChange
                  ? (date, personHours) => onPersonHoursForDateChange(row.planId, row.lineItemId, row.phase, date, personHours)
                  : undefined
              }
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
    />
  );
}

export function ScheduleGrid(props: ScheduleGridProps) {
  if (props.mode === 'shared') {
    return <SharedScheduleGrid {...props} />;
  }
  return <SingleScheduleGrid {...props} />;
}

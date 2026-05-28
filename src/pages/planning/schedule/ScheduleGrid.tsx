import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, PlanLineItem, WorkCalendarDay } from '../../../lib/planning/plan-model';
import { createPlan } from '../../../lib/planning/plan-model';
import { getPhaseFields, isPhaseActive } from '../../../lib/planning/plan-model';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { getAssignedDates } from '../../../lib/planning/scheduling/assignment';
import { buildSharedRows } from '../../../lib/planning/scheduling/schedule-hierarchy';
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
  getExtendedPhaseRange,
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
import { getEventGroupDayTint, getPhaseGroupDayTint } from './grid/schedule-grid-group-day-tint';
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
  planId: string;
  lineItems: PlanLineItem[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDates: PhaseDateValues;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  readOnly: boolean;
  onToggleAssignment: (lineItem: PlanLineItem, phase: BuildPhase, date: string, cellElement?: HTMLElement) => void;
  onClearRowSchedule?: (lineItem: PlanLineItem, phase: BuildPhase) => void;
  onPersonHoursForDateChange?: (lineItemId: string, phase: BuildPhase, date: string, personHours: number) => void;
  unresolvedIssueKeys?: Set<string>;
  activeIssueKey?: string | null;
  onToggleWorkday?: (date: string) => void;
  todayIso?: string;
  onEditDay?: (date: string, anchor: HTMLElement) => void;
  topLevelAccentColor?: string | null;
}

interface SharedScheduleGridProps {
  mode: 'shared';
  rows: SharedScheduleRow[];
  calendar: WorkCalendarDay[];
  capacity: CapacitySummary;
  phaseDatesByPlanId: Map<string, PhaseDateValues>;
  planDisplayNameByPlanId: Map<string, string>;
  projectAccentColorByPlanId?: Map<string, string>;
  itemByCompositeId: Map<string, PlanLineItem>;
  onAutoSchedule?: () => void;
  onToggleWorkday?: (date: string) => void;
  onEditDay?: (date: string, anchor: HTMLElement) => void;
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

function SingleScheduleGrid({
  planId,
  lineItems,
  calendar,
  capacity,
  phaseDates,
  eventStartDate,
  eventEndDate,
  readOnly,
  onToggleAssignment,
  onClearRowSchedule,
  onPersonHoursForDateChange,
  unresolvedIssueKeys,
  activeIssueKey,
  onToggleWorkday,
  todayIso,
  onEditDay,
  topLevelAccentColor,
}: SingleScheduleGridProps) {
  const dayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, day])),
    [capacity.days],
  );
  const hasPhaseWindows = hasCompletePhaseDates(phaseDates);
  const workDays = useMemo(() => calendar.filter((d) => d.isWorkDay), [calendar]);
  const schedulableUnscheduledCount = useMemo(
    () => getSchedulableUnscheduledPhaseRowCount(lineItems, phaseDates, workDays),
    [lineItems, phaseDates, workDays],
  );
  const phaseGroups = useMemo(() => groupByPhase(lineItems), [lineItems]);
  const eventDateRange = useMemo(
    () => (eventStartDate && eventEndDate ? { start: eventStartDate, end: eventEndDate } : null),
    [eventStartDate, eventEndDate],
  );
  const totalItemCount = phaseGroups.reduce((acc, g) => acc + g.rows.length, 0);
  const aggregatePlan = useMemo((): Plan => {
    const plan = createPlan('Event');
    plan.id = planId;
    plan.lineItems = lineItems;
    if (readOnly) {
      plan.status = 'reviewed';
      plan.reviewedAt = plan.updatedAt;
    }
    return plan;
  }, [planId, lineItems, readOnly]);
  const aggregateRows = useMemo(() => buildSharedRows([aggregatePlan]), [aggregatePlan]);
  const itemByCompositeId = useMemo(
    () => new Map(lineItems.map((item) => [mapKey(planId, item.id), item])),
    [planId, lineItems],
  );
  const phaseDatesByPlanId = useMemo(
    () => new Map([[planId, phaseDates]]),
    [planId, phaseDates],
  );
  const aggregateDayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, { isWorkDay: day.isWorkDay, accessHours: day.accessHours }])),
    [capacity.days],
  );
  const rowAggregatesByDate = useMemo(
    () => computeSharedRowAggregates({
      rows: aggregateRows,
      calendar,
      itemByCompositeId,
      phaseDatesByPlanId,
      dayByDate: aggregateDayByDate,
    }),
    [aggregateRows, calendar, itemByCompositeId, phaseDatesByPlanId, aggregateDayByDate],
  );
  const projectRowId = `project:${planId}`;
  const [isEventCollapsed, setIsEventCollapsed] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<BuildPhase>>(new Set());
  const unresolvedKeys = unresolvedIssueKeys ?? new Set<string>();

  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(260px, 1.35fr) repeat(${calendar.length}, minmax(144px, 1fr))`;
  const handleGridKeyboard = useScheduleGridKeyboardNavigation(calendar.length);

  useEffect(() => {
    if (!activeIssueKey) return;
    const phase = activeIssueKey.split(':').slice(-1)[0] as BuildPhase;
    if (!BUILD_PHASES.includes(phase)) return;
    setIsEventCollapsed(false);
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

  const toggleEvent = () => setIsEventCollapsed((prev) => !prev);

  const togglePhase = (phase: BuildPhase) => {
    setCollapsedPhases((prev) => toggleSetValue(prev, phase));
  };

  const renderRow = (item: PlanLineItem, phase: BuildPhase, rowIndex: number) => {
    const rowKey = `${item.id}:${phase}`;
    const pf = getPhaseFields(item, phase);
    const assignedDates = getAssignedDates(pf);
    const commercialPhaseRange = hasPhaseWindows ? getPhaseRange(phaseDates, phase) : null;
    const phaseRange = hasPhaseWindows
      ? (getExtendedPhaseRange(phaseDates, phase, eventStartDate ?? null, eventEndDate ?? null) ?? commercialPhaseRange)
      : null;

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
        commercialPhaseRange={commercialPhaseRange}
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
          unscheduledCount={schedulableUnscheduledCount}
          readOnly={readOnly}
          onToggleWorkday={onToggleWorkday}
          todayIso={todayIso}
          onEditDay={onEditDay}
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
        />
      )}
      body={(() => {
          let globalRowIdx = 0;
          return (
            <div className="schedule-grid__phase-group">
              {(() => {
                const eventRow = aggregateRows.find((row) => row.id === projectRowId && row.type === 'project');
                if (!eventRow) return null;
                return (
                  <ScheduleGridGroupRow
                    row={eventRow}
                    calendar={calendar}
                    gridColumns={gridColumns}
                    aggregateByDate={rowAggregatesByDate.get(projectRowId)}
                    topLevelAccentColor={topLevelAccentColor}
                    headerVariant="event"
                    itemCountOverride={totalItemCount}
                    getGroupDayTint={(day) => getEventGroupDayTint(day.date, {
                      isEventCollapsed,
                      phaseDates,
                      eventStartDate,
                      eventEndDate,
                      eventDateRange,
                    })}
                    isCollapsed={isEventCollapsed}
                    onToggle={toggleEvent}
                  />
                );
              })()}

              {/* ── Phase rows (depth 1) — only when event not collapsed ── */}
              {!isEventCollapsed && phaseGroups.map((group) => {
                const isCollapsed = collapsedPhases.has(group.phase);
                const startIdx = globalRowIdx;
                globalRowIdx += group.rows.length;
                const phaseRowId = `phase:${planId}:${group.phase}`;
                const phaseRow = aggregateRows.find((row) => row.id === phaseRowId && row.type === 'phase');
                if (!phaseRow || phaseRow.type !== 'phase') return null;
                const groupPhaseRange = hasPhaseWindows ? getPhaseRange(phaseDates, group.phase) : null;
                const groupExtendedRange = hasPhaseWindows
                  ? getExtendedPhaseRange(phaseDates, group.phase, eventStartDate ?? null, eventEndDate ?? null)
                  : null;
                return (
                  <div key={group.phase} className="schedule-grid__phase-group">
                    <ScheduleGridGroupRow
                      row={phaseRow}
                      calendar={calendar}
                      gridColumns={gridColumns}
                      aggregateByDate={rowAggregatesByDate.get(phaseRowId)}
                      getGroupDayTint={(day) => getPhaseGroupDayTint(day.date, groupPhaseRange, groupExtendedRange)}
                      isCollapsed={isCollapsed}
                      onToggle={() => togglePhase(group.phase)}
                    />
                    {!isCollapsed && group.rows.map(({ item, phase }, i) =>
                      renderRow(item, phase, startIdx + i),
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
    />
  );
}

function SharedScheduleGrid({
  rows,
  calendar,
  capacity,
  phaseDatesByPlanId,
  planDisplayNameByPlanId,
  projectAccentColorByPlanId,
  itemByCompositeId,
  onAutoSchedule,
  onToggleWorkday,
  onEditDay,
  onToggleAssignment,
  onPersonHoursForDateChange,
}: SharedScheduleGridProps) {
  const dayByDate = useMemo(
    () => new Map(capacity.days.map((day) => [day.date, day])),
    [capacity.days],
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = `minmax(280px, 1.6fr) repeat(${calendar.length}, minmax(144px, 1fr))`;
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
          onToggleWorkday={onToggleWorkday}
          onEditDay={onEditDay}
          unscheduledCount={schedulableUnscheduledCount}
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
              commercialPhaseRange={phaseRange}
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

        let phaseRange = null;
        if (row.type === 'phase') {
          const pd = phaseDatesByPlanId.get(row.planId);
          if (pd && hasCompletePhaseDates(pd)) {
            phaseRange = getPhaseRange(pd, row.phase);
          }
        }

        return (
          <ScheduleGridGroupRow
            key={row.id}
            row={row}
            calendar={calendar}
            gridColumns={gridColumns}
            aggregateByDate={rowAggregatesByDate.get(row.id)}
            topLevelAccentColor={isProject ? projectAccentColorByPlanId?.get(row.planId) : undefined}
            getGroupDayTint={phaseRange ? (day) => getPhaseGroupDayTint(day.date, phaseRange, null) : undefined}
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

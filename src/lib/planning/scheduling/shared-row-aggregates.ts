import type { BuildPhase } from '../../types';
import { getAssignedDates } from './assignment';
import {
  getPhaseFields,
  getPlannedPersonHoursForDate,
  type PlanLineItem,
  type WorkCalendarDay,
} from '../plan-model';
import { getCrewEquivalentForDate } from './capacity-math';
import { resolveRequiredPersonHoursForPhase } from './auto-schedule';
import type { PhaseDateValues } from './schedule-span';
import { getPhaseRange, hasCompletePhaseDates, isDateWithinSpan } from './schedule-span';
import type { SharedScheduleRow } from './shared-schedule-types';

export interface RowAggregate {
  requiredHours: number;
  assignedCrew: number;
  /** Assigned crew capacity in person-hours (assignedCrew x accessHours). */
  assignedCapacityHours: number;
  /** Work hours that could not be placed on the last day of an item's span within this group. */
  shortfallHours: number;
}

export interface ComputeSharedRowAggregatesInput {
  rows: SharedScheduleRow[];
  calendar: WorkCalendarDay[];
  itemByCompositeId: Map<string, PlanLineItem>;
  phaseDatesByPlanId: Map<string, PhaseDateValues>;
  dayByDate: Map<string, { isWorkDay: boolean; accessHours: number }>;
}

function mapKey(planId: string, lineItemId: string): string {
  return `${planId}:${lineItemId}`;
}

function getAssignedDatesWithinPhase(
  item: PlanLineItem,
  phase: BuildPhase,
  phaseDates: PhaseDateValues | undefined,
): string[] {
  const pf = getPhaseFields(item, phase);
  const all = getAssignedDates(pf);
  if (!phaseDates || !hasCompletePhaseDates(phaseDates)) return all;
  const span = getPhaseRange(phaseDates, phase);
  if (!span) return all;
  return all.filter((date) => isDateWithinSpan(date, span));
}

export function computeSharedRowAggregates(
  input: ComputeSharedRowAggregatesInput,
): Map<string, Map<string, RowAggregate>> {
  const {
    rows,
    calendar,
    itemByCompositeId,
    phaseDatesByPlanId,
    dayByDate,
  } = input;

  const byRow = new Map<string, Array<{ planId: string; item: PlanLineItem; phase: BuildPhase }>>();

  const add = (rowId: string, ref: { planId: string; item: PlanLineItem; phase: BuildPhase }) => {
    const existing = byRow.get(rowId) ?? [];
    existing.push(ref);
    byRow.set(rowId, existing);
  };

  for (const row of rows) {
    if (row.type !== 'item') continue;
    const item = itemByCompositeId.get(mapKey(row.planId, row.lineItemId));
    if (!item) continue;
    const ref = { planId: row.planId, item, phase: row.phase };
    add(row.id, ref);
    add(row.phaseRowId, ref);
    add(row.projectRowId, ref);
  }

  const aggregateMap = new Map<string, Map<string, RowAggregate>>();

  for (const [rowId, itemRefs] of byRow) {
    const byDate = new Map<string, RowAggregate>();
    for (const day of calendar) {
      byDate.set(day.date, { requiredHours: 0, assignedCrew: 0, assignedCapacityHours: 0, shortfallHours: 0 });
    }

    for (const { planId, item, phase } of itemRefs) {
      const pf = getPhaseFields(item, phase);
      const phaseDates = phaseDatesByPlanId.get(planId);
      const assignedDates = getAssignedDatesWithinPhase(item, phase, phaseDates);
      if (assignedDates.length === 0) continue;

      let remaining = resolveRequiredPersonHoursForPhase(item, phase) ?? (pf.timeHours * pf.crew);
      const lastDate = assignedDates[assignedDates.length - 1];
      for (const date of assignedDates) {
        const day = dayByDate.get(date);
        if (!day) continue;
        const aggregate = byDate.get(date);
        if (!aggregate) continue;
        const plannedPersonHours = getPlannedPersonHoursForDate(item, phase, date);
        const accessHours = day.accessHours || 8;
        const crew = getCrewEquivalentForDate(item, phase, date, accessHours);

        // Always count assigned crew for days in span (user may assign more crew than work needs)
        if (day.isWorkDay && crew > 0) {
          aggregate.assignedCrew += crew;
          aggregate.assignedCapacityHours += plannedPersonHours;
        }

        if (remaining <= 0) continue;

        const dayCapacity = day.isWorkDay ? plannedPersonHours : 0;
        const work = Math.min(remaining, dayCapacity);
        aggregate.requiredHours += work;
        remaining -= work;

        if (date === lastDate && remaining > 0.01) {
          aggregate.shortfallHours += remaining;
        }
      }
    }

    for (const [date, aggregate] of byDate) {
      byDate.set(date, {
        requiredHours: Math.round(aggregate.requiredHours * 10) / 10,
        assignedCrew: Math.round(aggregate.assignedCrew * 10) / 10,
        assignedCapacityHours: Math.round(aggregate.assignedCapacityHours * 10) / 10,
        shortfallHours: Math.round(aggregate.shortfallHours * 10) / 10,
      });
    }

    aggregateMap.set(rowId, byDate);
  }

  return aggregateMap;
}

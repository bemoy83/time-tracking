import type { Plan } from '../plan-model';
import { getEffectiveCrewForDate } from '../plan-model';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  dayCrewSize,
  hasSchedulingCalendar,
  listDateRange,
} from './work-calendar';

export interface DailyCapacity {
  date: string;
  isWorkDay: boolean;
  requiredPersonHours: number;
  availablePersonHours: number;
  /** Access hours per worker for this day (e.g. 8 for 08:00–16:00). */
  accessHours: number;
  /** Available crew from work calendar for this day. */
  availableCrew: number;
  /** Sum of assigned crew across all line items on this day. */
  assignedCrewTotal: number;
  utilization: number | null;
  lineItemCount: number;
  isOverAllocated: boolean;
  /** True when assignedCrewTotal > availableCrew. */
  isOverAssignedCrew: boolean;
  /** True when any line item on this day has personHours > effectiveCrew × accessHours. */
  isOverWorkerCapacity: boolean;
}

export interface CapacitySummary {
  days: DailyCapacity[];
  totalRequiredPersonHours: number;
  totalAvailablePersonHours: number;
  headroomPersonHours: number;
  overAllocatedDayCount: number;
  /** Number of days where assigned crew exceeds available crew. */
  overAssignedCrewDayCount: number;
  /** Number of days where any line item exceeds worker capacity (personHours > crew × accessHours). */
  overWorkerCapacityDayCount: number;
  unscheduledLineItemCount: number;
  scheduledLineItemCount: number;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function buildDayMap(plan: Plan): Map<string, DailyCapacity> {
  const days = hasSchedulingCalendar(plan)
    ? plan.workCalendar
    : listDateRange(plan.eventStartDate ?? '', plan.eventEndDate ?? '').map((date) => ({
      date,
      isWorkDay: true,
      accessStart: '08:00' as string | null,
      accessEnd: '16:00' as string | null,
      crewSize: plan.defaultCrewSize,
    }));

  const dayMap = new Map<string, DailyCapacity>();
  for (const day of days) {
    const available = dayAvailablePersonHours(day, plan.defaultCrewSize);
    const crew = dayCrewSize(day, plan.defaultCrewSize);
    const access = dayAccessHours(day);
    dayMap.set(day.date, {
      date: day.date,
      isWorkDay: day.isWorkDay,
      requiredPersonHours: 0,
      availablePersonHours: round2(available),
      accessHours: access,
      availableCrew: crew,
      assignedCrewTotal: 0,
      utilization: available > 0 ? 0 : null,
      lineItemCount: 0,
      isOverAllocated: false,
      isOverAssignedCrew: false,
      isOverWorkerCapacity: false,
    });
  }
  return dayMap;
}

function listScheduledDates(start: string, end: string): string[] {
  return listDateRange(start, end);
}

export function computeCapacitySummary(plan: Plan): CapacitySummary {
  const dayMap = buildDayMap(plan);
  let unscheduledLineItemCount = 0;
  let scheduledLineItemCount = 0;

  for (const item of plan.lineItems) {
    if (!item.scheduledStart || !item.scheduledEnd) {
      unscheduledLineItemCount += 1;
      continue;
    }

    const dates = listScheduledDates(item.scheduledStart, item.scheduledEnd);
    if (dates.length === 0) {
      unscheduledLineItemCount += 1;
      continue;
    }
    scheduledLineItemCount += 1;

    // Always even-split: person-hours distributed equally across assigned days.
    // crewByDate is for capacity validation only (not proportional distribution).
    const totalPersonHours = item.timeHours * item.crew;
    const perDay = totalPersonHours / dates.length;

    for (const date of dates) {
      const day = dayMap.get(date);
      if (!day) continue;
      const effectiveCrew = getEffectiveCrewForDate(item, date);
      day.requiredPersonHours += perDay;
      day.assignedCrewTotal += effectiveCrew;
      day.lineItemCount += 1;
      // Worker capacity: can this crew physically work perDay hours?
      const maxAllowed = effectiveCrew * (day.accessHours || 8);
      if (perDay > maxAllowed + 0.01) {
        day.isOverWorkerCapacity = true;
      }
    }
  }

  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const required = round2(day.requiredPersonHours);
      const available = round2(day.availablePersonHours);
      const utilization = available > 0 ? round2(required / available) : null;
      const isOverAssignedCrew = day.isWorkDay && day.assignedCrewTotal > day.availableCrew;
      return {
        ...day,
        requiredPersonHours: required,
        availablePersonHours: available,
        utilization,
        isOverAllocated: available > 0 ? required > available : required > 0,
        isOverAssignedCrew,
      };
    });

  const totalRequiredPersonHours = round2(days.reduce((sum, day) => sum + day.requiredPersonHours, 0));
  const totalAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.availablePersonHours, 0));
  const headroomPersonHours = round2(totalAvailablePersonHours - totalRequiredPersonHours);
  const overAllocatedDayCount = days.filter((day) => day.isOverAllocated).length;
  const overAssignedCrewDayCount = days.filter((day) => day.isOverAssignedCrew).length;
  const overWorkerCapacityDayCount = days.filter((day) => day.isOverWorkerCapacity).length;

  return {
    days,
    totalRequiredPersonHours,
    totalAvailablePersonHours,
    headroomPersonHours,
    overAllocatedDayCount,
    overAssignedCrewDayCount,
    overWorkerCapacityDayCount,
    unscheduledLineItemCount,
    scheduledLineItemCount,
  };
}

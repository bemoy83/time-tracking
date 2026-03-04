import type { Plan, PlanLineItem, WorkCalendarDay } from '../plan-model';
import { getEffectiveCrewForDate, getPhaseSpan } from '../plan-model';
import type { SharedScheduleInput } from './shared-schedule-types';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  dayCrewSize,
  getEffectiveScheduleSpan,
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
  /** Assigned crew × access hours — the person-hours the assigned crew can provide. */
  assignedCapacityPersonHours: number;
  /** True if at least one line item has this date as its last assigned day. */
  isCompletionDay: boolean;
  /** When over-worker: work still needed at start of this day to meet estimate (required + deficit). */
  needToMeetTargetPersonHours: number;
  /** True when assigned crew capacity exceeds required person-hours on a work day with work. */
  isOverStaffed: boolean;
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
  /** Number of days where assigned crew capacity exceeds required person-hours. */
  overStaffedDayCount: number;
}

interface ScheduleCounters {
  unscheduledLineItemCount: number;
  scheduledLineItemCount: number;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function buildDayMapFromCalendar(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
): Map<string, DailyCapacity> {
  const dayMap = new Map<string, DailyCapacity>();
  for (const day of calendar) {
    const available = dayAvailablePersonHours(day, defaultCrewSize);
    const crew = dayCrewSize(day, defaultCrewSize);
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
      assignedCapacityPersonHours: 0,
      isCompletionDay: false,
      needToMeetTargetPersonHours: 0,
      isOverStaffed: false,
    });
  }
  return dayMap;
}

function buildDayMap(plan: Plan): Map<string, DailyCapacity> {
  const effectiveSpan = getEffectiveScheduleSpan(plan);
  const days = hasSchedulingCalendar(plan)
    ? plan.workCalendar
    : effectiveSpan
      ? listDateRange(effectiveSpan.start, effectiveSpan.end).map((date) => ({
          date,
          isWorkDay: true,
          accessStart: '08:00' as string | null,
          accessEnd: '16:00' as string | null,
          crewSize: plan.defaultCrewSize,
        }))
      : [];

  return buildDayMapFromCalendar(days, plan.defaultCrewSize);
}

function listScheduledDates(start: string, end: string): string[] {
  return listDateRange(start, end);
}

function applyScheduledItem(
  dayMap: Map<string, DailyCapacity>,
  item: PlanLineItem,
  dates: string[],
): void {
  // Sequential fill: crew works each day in calendar order, contributing
  // their full capacity until the item's work is complete. All person-hours
  // count toward the goal — no artificial spreading.
  const totalPersonHours = item.timeHours * item.crew;
  let remaining = totalPersonHours;
  const lastDate = dates[dates.length - 1];

  for (const date of dates) {
    const day = dayMap.get(date);
    if (!day) continue;
    const effectiveCrew = getEffectiveCrewForDate(item, date);
    const capacity = day.isWorkDay ? effectiveCrew * (day.accessHours || 8) : 0;

    if (remaining <= 0) {
      // Work already complete — crew is assigned but has no work from this item
      day.lineItemCount += 1;
      continue;
    }

    const work = Math.min(remaining, capacity);
    day.requiredPersonHours += work;
    if (day.isWorkDay) day.assignedCrewTotal += effectiveCrew;
    day.lineItemCount += 1;
    remaining -= work;

    if (date === lastDate && remaining > 0.01) {
      day.isOverWorkerCapacity = true;
      day.needToMeetTargetPersonHours += work + remaining;
    }
  }

  const lastDay = dayMap.get(lastDate);
  if (lastDay) lastDay.isCompletionDay = true;
}

function finalizeCapacitySummary(
  dayMap: Map<string, DailyCapacity>,
  counters: ScheduleCounters,
): CapacitySummary {
  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const required = round2(day.requiredPersonHours);
      const available = round2(day.availablePersonHours);
      const utilization = available > 0 ? round2(required / available) : null;
      const isOverAssignedCrew = day.isWorkDay && day.assignedCrewTotal > day.availableCrew;
      const assignedCapacityPersonHours = round2(day.assignedCrewTotal * (day.accessHours || 8));
      const needToMeetTargetPersonHours = round2(day.needToMeetTargetPersonHours || 0);
      const isOverStaffed = day.isWorkDay && required > 0.01 && assignedCapacityPersonHours > required + 0.01;
      return {
        ...day,
        requiredPersonHours: required,
        availablePersonHours: available,
        utilization,
        isOverAllocated: available > 0 ? required > available : required > 0,
        isOverAssignedCrew,
        assignedCapacityPersonHours,
        needToMeetTargetPersonHours,
        isOverStaffed,
      };
    });

  const totalRequiredPersonHours = round2(days.reduce((sum, day) => sum + day.requiredPersonHours, 0));
  const totalAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.availablePersonHours, 0));
  const headroomPersonHours = round2(totalAvailablePersonHours - totalRequiredPersonHours);
  const overAllocatedDayCount = days.filter((day) => day.isOverAllocated).length;
  const overAssignedCrewDayCount = days.filter((day) => day.isOverAssignedCrew).length;
  const overWorkerCapacityDayCount = days.filter((day) => day.isOverWorkerCapacity).length;
  const overStaffedDayCount = days.filter((day) => day.isOverStaffed).length;

  return {
    days,
    totalRequiredPersonHours,
    totalAvailablePersonHours,
    headroomPersonHours,
    overAllocatedDayCount,
    overAssignedCrewDayCount,
    overWorkerCapacityDayCount,
    unscheduledLineItemCount: counters.unscheduledLineItemCount,
    scheduledLineItemCount: counters.scheduledLineItemCount,
    overStaffedDayCount,
  };
}

export function computeCapacitySummary(plan: Plan): CapacitySummary {
  const dayMap = buildDayMap(plan);
  const counters: ScheduleCounters = {
    unscheduledLineItemCount: 0,
    scheduledLineItemCount: 0,
  };

  for (const item of plan.lineItems) {
    if (!item.scheduledStart || !item.scheduledEnd) {
      counters.unscheduledLineItemCount += 1;
      continue;
    }

    const dates = listScheduledDates(item.scheduledStart, item.scheduledEnd);
    if (dates.length === 0) {
      counters.unscheduledLineItemCount += 1;
      continue;
    }

    counters.scheduledLineItemCount += 1;
    applyScheduledItem(dayMap, item, dates);
  }

  return finalizeCapacitySummary(dayMap, counters);
}

export function computeSharedCapacitySummary(input: SharedScheduleInput): CapacitySummary {
  const dayMap = buildDayMapFromCalendar(input.calendar, input.defaultCrewSize);
  const counters: ScheduleCounters = {
    unscheduledLineItemCount: 0,
    scheduledLineItemCount: 0,
  };

  for (const entry of input.lineItems) {
    const { item, plan } = entry;
    if (!item.scheduledStart || !item.scheduledEnd) {
      counters.unscheduledLineItemCount += 1;
      continue;
    }

    const dates = listScheduledDates(item.scheduledStart, item.scheduledEnd);
    const phaseSpan = getPhaseSpan(plan, item.buildPhase);
    const validDates = phaseSpan
      ? dates.filter((date) => date >= phaseSpan.start && date <= phaseSpan.end)
      : dates;

    if (validDates.length === 0) {
      counters.unscheduledLineItemCount += 1;
      continue;
    }

    counters.scheduledLineItemCount += 1;
    applyScheduledItem(dayMap, item, validDates);
  }

  return finalizeCapacitySummary(dayMap, counters);
}

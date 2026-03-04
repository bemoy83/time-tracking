import { getEffectiveCrewForDate, type PlanLineItem, type WorkCalendarDay } from '../plan-model';
import type { CapacitySummary, DailyCapacity } from './capacity';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  dayCrewSize,
} from './work-calendar';

export interface NormalizedScheduledEntry {
  item: PlanLineItem;
  dates: string[];
}

export interface CapacityComputationInput {
  calendar: WorkCalendarDay[];
  defaultCrewSize: number | null;
  scheduledEntries: NormalizedScheduledEntry[];
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

function applyScheduledItem(
  dayMap: Map<string, DailyCapacity>,
  item: PlanLineItem,
  dates: string[],
): void {
  const totalPersonHours = item.timeHours * item.crew;
  let remaining = totalPersonHours;
  const lastDate = dates[dates.length - 1];

  for (const date of dates) {
    const day = dayMap.get(date);
    if (!day) continue;
    const effectiveCrew = getEffectiveCrewForDate(item, date);
    const capacity = day.isWorkDay ? effectiveCrew * (day.accessHours || 8) : 0;

    if (remaining <= 0) {
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
  unscheduledLineItemCount: number,
  scheduledLineItemCount: number,
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
    unscheduledLineItemCount,
    scheduledLineItemCount,
    overStaffedDayCount,
  };
}

export function computeCapacityFromNormalizedInput(
  input: CapacityComputationInput,
): CapacitySummary {
  const dayMap = buildDayMapFromCalendar(input.calendar, input.defaultCrewSize);

  for (const entry of input.scheduledEntries) {
    applyScheduledItem(dayMap, entry.item, entry.dates);
  }

  return finalizeCapacitySummary(
    dayMap,
    input.unscheduledLineItemCount,
    input.scheduledLineItemCount,
  );
}

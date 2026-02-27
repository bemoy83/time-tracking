import type { Plan } from '../plan-model';
import {
  dayAvailablePersonHours,
  hasSchedulingCalendar,
  listDateRange,
} from './work-calendar';

export interface DailyCapacity {
  date: string;
  isWorkDay: boolean;
  requiredPersonHours: number;
  availablePersonHours: number;
  utilization: number | null;
  lineItemCount: number;
  isOverAllocated: boolean;
}

export interface CapacitySummary {
  days: DailyCapacity[];
  totalRequiredPersonHours: number;
  totalAvailablePersonHours: number;
  headroomPersonHours: number;
  overAllocatedDayCount: number;
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
      accessStart: '08:00',
      accessEnd: '16:00',
      crewSize: plan.defaultCrewSize,
    }));

  const dayMap = new Map<string, DailyCapacity>();
  for (const day of days) {
    const available = dayAvailablePersonHours(day, plan.defaultCrewSize);
    dayMap.set(day.date, {
      date: day.date,
      isWorkDay: day.isWorkDay,
      requiredPersonHours: 0,
      availablePersonHours: round2(available),
      utilization: available > 0 ? 0 : null,
      lineItemCount: 0,
      isOverAllocated: false,
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

    const totalPersonHours = item.timeHours * item.crew;
    const perDay = totalPersonHours / dates.length;

    for (const date of dates) {
      const day = dayMap.get(date);
      if (!day) continue;
      day.requiredPersonHours += perDay;
      day.lineItemCount += 1;
    }
  }

  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const required = round2(day.requiredPersonHours);
      const available = round2(day.availablePersonHours);
      const utilization = available > 0 ? round2(required / available) : null;
      return {
        ...day,
        requiredPersonHours: required,
        availablePersonHours: available,
        utilization,
        isOverAllocated: available > 0 ? required > available : required > 0,
      };
    });

  const totalRequiredPersonHours = round2(days.reduce((sum, day) => sum + day.requiredPersonHours, 0));
  const totalAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.availablePersonHours, 0));
  const headroomPersonHours = round2(totalAvailablePersonHours - totalRequiredPersonHours);
  const overAllocatedDayCount = days.filter((day) => day.isOverAllocated).length;

  return {
    days,
    totalRequiredPersonHours,
    totalAvailablePersonHours,
    headroomPersonHours,
    overAllocatedDayCount,
    unscheduledLineItemCount,
    scheduledLineItemCount,
  };
}

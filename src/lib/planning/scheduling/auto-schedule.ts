/**
 * Auto-schedule: distribute unscheduled line items across work days
 * using a greedy load-balancing algorithm.
 */

import type { Plan } from '../plan-model';
import { getPhaseSpan, hasPhaseDates, updatePlanLineItem } from '../plan-model';
import { dayAvailablePersonHours } from './work-calendar';
import { listDateRange } from './work-calendar';

interface DayLoad {
  date: string;
  available: number;
  assigned: number;
}

/**
 * Auto-schedule unscheduled line items into the plan's work calendar.
 * Strategy: sort items by person-hours descending, then for each item
 * find the earliest contiguous span of work days that minimizes peak load.
 * Initializes crewByDate with item.crew for each assigned day.
 */
export function autoSchedule(plan: Plan): Plan {
  const { defaultCrewSize, workCalendar } = plan;
  const calendar = workCalendar.length > 0 ? workCalendar : [];
  if (calendar.length === 0) return plan;

  const workDays = calendar.filter((d) => d.isWorkDay);
  if (workDays.length === 0) return plan;
  const hasPhaseWindows = hasPhaseDates(plan);

  // Build day load tracker
  const dayLoadMap = new Map<string, DayLoad>();
  for (const day of workDays) {
    dayLoadMap.set(day.date, {
      date: day.date,
      available: dayAvailablePersonHours(day, defaultCrewSize),
      assigned: 0,
    });
  }

  // Account for already-scheduled items
  for (const item of plan.lineItems) {
    if (!item.scheduledStart || !item.scheduledEnd) continue;
    const dates = listDateRange(item.scheduledStart, item.scheduledEnd);
    const totalPH = item.timeHours * item.crew;
    const perDay = dates.length > 0 ? totalPH / dates.length : 0;
    for (const date of dates) {
      const load = dayLoadMap.get(date);
      if (load) load.assigned += perDay;
    }
  }

  // Collect unscheduled items, sort by person-hours descending
  const unscheduled = plan.lineItems
    .filter((item) => !item.scheduledStart || !item.scheduledEnd)
    .map((item) => ({
      item,
      totalPH: item.timeHours * item.crew,
    }))
    .sort((a, b) => b.totalPH - a.totalPH);

  if (unscheduled.length === 0) return plan;

  let result = plan;

  for (const { item, totalPH } of unscheduled) {
    const candidateWorkDays = hasPhaseWindows
      ? (() => {
          const phaseSpan = getPhaseSpan(plan, item.buildPhase);
          if (!phaseSpan) return [];
          return workDays.filter((d) => d.date >= phaseSpan.start && d.date <= phaseSpan.end);
        })()
      : workDays;
    if (candidateWorkDays.length === 0) continue;

    const workDayDates = candidateWorkDays.map((d) => d.date);

    // Determine min span length needed: ceil(totalPH / maxDailyAvailable)
    const maxDailyAvail = Math.max(
      ...candidateWorkDays.map((d) => dayAvailablePersonHours(d, defaultCrewSize)),
      1,
    );
    const minSpanDays = Math.max(1, Math.ceil(totalPH / maxDailyAvail));
    const spanLength = Math.min(minSpanDays, workDayDates.length);

    // Find best starting position (lowest peak load after assignment)
    let bestStart = 0;
    let bestPeakUtil = Infinity;

    for (let start = 0; start <= workDayDates.length - spanLength; start++) {
      const span = workDayDates.slice(start, start + spanLength);
      const perDay = totalPH / span.length;
      let peakUtil = 0;
      for (const date of span) {
        const load = dayLoadMap.get(date)!;
        const util = load.available > 0 ? (load.assigned + perDay) / load.available : Infinity;
        if (util > peakUtil) peakUtil = util;
      }
      if (peakUtil < bestPeakUtil) {
        bestPeakUtil = peakUtil;
        bestStart = start;
      }
    }

    const assignedDates = workDayDates.slice(bestStart, bestStart + spanLength);
    const perDay = totalPH / assignedDates.length;

    // Update load tracker
    for (const date of assignedDates) {
      const load = dayLoadMap.get(date)!;
      load.assigned += perDay;
    }

    // Build crewByDate
    const crewByDate: Record<string, number> = {};
    for (const date of assignedDates) {
      crewByDate[date] = item.crew;
    }

    // The scheduled span must be contiguous calendar dates (not just work days)
    const startDate = assignedDates[0];
    const endDate = assignedDates[assignedDates.length - 1];

    result = updatePlanLineItem(result, item.id, {
      scheduledStart: startDate,
      scheduledEnd: endDate,
      crewByDate,
    });
  }

  return result;
}

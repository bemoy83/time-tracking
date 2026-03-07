/**
 * Auto-schedule: distribute unscheduled line items across work days
 * using a greedy crew-pool-aware algorithm.
 *
 * Core model: crew headcount is the finite resource. Each work day has
 * a crew pool (day.crewSize ?? plan.defaultCrewSize). The algorithm
 * places items by deducting crew from that pool, so later items see
 * what's actually left.
 */

import type { Plan } from '../plan-model';
import { getPhaseSpan, updatePlanLineItem } from '../plan-model';
import { dayAccessHours, dayCrewSize } from './work-calendar';

interface DayState {
  date: string;
  accessHours: number;
  totalCrew: number;
  remainingCrew: number;
}

/**
 * Auto-schedule unscheduled line items into the plan's work calendar.
 *
 * Math: requiredPH = workQuantity / productivityRate.
 * Each work day can deliver min(requestedCrew, remainingCrew) × accessHours
 * person-hours toward that requirement.
 *
 * Algorithm:
 * 1. Build per-day state tracking crew headcount.
 * 2. Reserve crew for already-scheduled items.
 * 3. For each unscheduled item (largest required PH first):
 *    a. Walk candidate days from each start position, accumulating
 *       deliverable PH per day until requiredPH is met — this gives
 *       the minimum span length for that start.
 *    b. Pick the start position that needs the fewest days (tightest fit),
 *       breaking ties by most remaining crew (least-loaded).
 *    c. Allocate crew, reducing the day pool for subsequent items.
 *    d. If no window can fully cover requiredPH, use all candidate days
 *       (capacity view will flag the shortfall).
 */
export function autoSchedule(plan: Plan): Plan {
  const { defaultCrewSize, workCalendar } = plan;
  if (workCalendar.length === 0) return plan;

  const workDays = workCalendar.filter((d) => d.isWorkDay);
  if (workDays.length === 0) return plan;

  // 1. Build per-day state
  const dayStateMap = new Map<string, DayState>();
  for (const day of workDays) {
    const crew = dayCrewSize(day, defaultCrewSize);
    dayStateMap.set(day.date, {
      date: day.date,
      accessHours: dayAccessHours(day),
      totalCrew: crew,
      remainingCrew: crew,
    });
  }

  // 2. Reserve crew for already-scheduled items
  for (const item of plan.lineItems) {
    if (!item.scheduledStart || !item.scheduledEnd) continue;
    for (const [date, state] of dayStateMap) {
      if (date < item.scheduledStart || date > item.scheduledEnd) continue;
      const crew = item.crewByDate?.[date] ?? item.crew;
      state.remainingCrew -= crew;
    }
  }

  // 3. Collect unscheduled items
  const unscheduled = plan.lineItems
    .filter((item) => !item.scheduledStart || !item.scheduledEnd)
    .map((item) => {
      const effectiveRate = item.productivityRate > 0 ? item.productivityRate : 1;
      const requiredPH = item.workQuantity / effectiveRate;
      return { item, requiredPH };
    })
    .filter((x) => x.requiredPH > 0)
    .sort((a, b) => b.requiredPH - a.requiredPH);

  if (unscheduled.length === 0) return plan;

  let result = plan;

  for (const { item, requiredPH } of unscheduled) {
    // Get candidate work days: constrain to item's phase span when that phase has dates, else use all days
    const span = getPhaseSpan(plan, item.buildPhase);
    const candidates = span
      ? workDays
          .filter((d) => d.date >= span.start && d.date <= span.end)
          .map((d) => dayStateMap.get(d.date)!)
          .filter(Boolean)
      : workDays.map((d) => dayStateMap.get(d.date)!).filter(Boolean);

    if (candidates.length === 0) continue;

    const requestedCrew = item.crew > 0 ? item.crew : 1;

    // For each possible start position, walk forward accumulating
    // deliverable PH until requiredPH is met. Track the span length needed.
    let bestStart = 0;
    let bestSpanLength = candidates.length; // fallback: use all days
    let bestMinRemaining = -Infinity;
    let bestCovers = false; // whether the best window fully covers requiredPH

    for (let start = 0; start < candidates.length; start++) {
      let accumulated = 0;
      let spanLen = 0;
      let minRemaining = Infinity;

      for (let i = start; i < candidates.length; i++) {
        const day = candidates[i];
        const usableCrew = Math.max(1, Math.min(requestedCrew, day.remainingCrew));
        accumulated += usableCrew * day.accessHours;
        spanLen++;
        if (day.remainingCrew < minRemaining) minRemaining = day.remainingCrew;
        if (accumulated >= requiredPH) break;
      }

      const covers = accumulated >= requiredPH;

      // Prefer windows that fully cover requiredPH.
      // Among covering windows: fewest days, then most remaining crew.
      // A non-covering window only wins if no covering window exists.
      const dominated =
        bestCovers && !covers ? true
        : !bestCovers && covers ? false
        : spanLen > bestSpanLength ? true
        : spanLen < bestSpanLength ? false
        : minRemaining <= bestMinRemaining;

      if (!dominated) {
        bestSpanLength = spanLen;
        bestMinRemaining = minRemaining;
        bestStart = start;
        bestCovers = covers;
      }
    }

    const assignedSlice = candidates.slice(bestStart, bestStart + bestSpanLength);
    if (assignedSlice.length === 0) continue;

    // Build crewByDate: allocate min(requested, remaining) per day,
    // distributing exactly requiredPH across the span.
    const crewByDate: Record<string, number> = {};
    let phLeft = requiredPH;

    for (const dayState of assignedSlice) {
      const usableCrew = Math.max(1, Math.min(requestedCrew, dayState.remainingCrew));
      const dayPH = usableCrew * dayState.accessHours;
      const delivered = Math.min(dayPH, phLeft);
      // Crew actually needed this day (may be less on the final day)
      const crewThisDay = dayState.accessHours > 0
        ? Math.max(1, Math.ceil(delivered / dayState.accessHours))
        : usableCrew;
      crewByDate[dayState.date] = crewThisDay;
      dayState.remainingCrew -= crewThisDay;
      phLeft -= delivered;
    }

    const startDate = assignedSlice[0].date;
    const endDate = assignedSlice[assignedSlice.length - 1].date;
    // Actual total crew used is the max across days (for timeHours derivation)
    const maxCrewUsed = Math.max(...Object.values(crewByDate));
    const timeHours = requiredPH / maxCrewUsed;

    const updates: Parameters<typeof updatePlanLineItem>[2] = {
      scheduledStart: startDate,
      scheduledEnd: endDate,
      crewByDate,
    };
    if (item.crew <= 0) {
      updates.crew = maxCrewUsed;
    }
    if (item.timeHours <= 0 || Math.abs(item.timeHours - timeHours) > 0.01) {
      updates.timeHours = Math.round(timeHours * 100) / 100;
    }

    result = updatePlanLineItem(result, item.id, updates);
  }

  return result;
}

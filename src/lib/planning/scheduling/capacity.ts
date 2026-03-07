import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPhaseSpan } from '../plan-model';
import type { SharedScheduleInput } from './shared-schedule-types';
import {
  getEffectiveScheduleSpan,
  hasSchedulingCalendar,
  listDateRange,
} from './work-calendar';
import {
  computeCapacityFromNormalizedInput,
  type NormalizedScheduledEntry,
} from './capacity-core';

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
  /** True when assignedCrewTotal > availableCrew (derived from crew display: assigned/available). */
  isOverWorkerCapacity: boolean;
  /** Assigned crew × access hours — the person-hours the assigned crew can provide. */
  assignedCapacityPersonHours: number;
  /** True if at least one line item has this date as its last assigned day. */
  isCompletionDay: boolean;
  /** When over-worker: work still needed at start of this day to meet estimate (required + deficit). */
  needToMeetTargetPersonHours: number;
  /** Person-hours of work that could not be placed on the last day of each item's span (sum across all items). */
  shortfallPersonHours: number;
  /** True when assignedCrewTotal < availableCrew on a work day with work (excess spare capacity; derived from crew display). */
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
  /** Number of days where assigned crew exceeds available crew (derived from crew display: X/Y crew). */
  overWorkerCapacityDayCount: number;
  unscheduledLineItemCount: number;
  scheduledLineItemCount: number;
  /** Number of days where assigned crew < available crew (excess spare capacity; derived from crew display X/Y crew). */
  overStaffedDayCount: number;
}

function listScheduledDates(start: string, end: string): string[] {
  return listDateRange(start, end);
}

function createPlanCapacityCalendar(plan: Plan): WorkCalendarDay[] {
  const effectiveSpan = getEffectiveScheduleSpan(plan);
  if (hasSchedulingCalendar(plan)) {
    return plan.workCalendar;
  }

  if (!effectiveSpan) {
    return [];
  }

  return listDateRange(effectiveSpan.start, effectiveSpan.end).map((date) => ({
    date,
    isWorkDay: true,
    accessStart: '08:00',
    accessEnd: '16:00',
    crewSize: plan.defaultCrewSize,
  }));
}

function buildSinglePlanEntries(plan: Plan): {
  scheduledEntries: NormalizedScheduledEntry[];
  scheduledLineItemCount: number;
  unscheduledLineItemCount: number;
} {
  const scheduledEntries: NormalizedScheduledEntry[] = [];
  let unscheduledLineItemCount = 0;

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

    scheduledEntries.push({ item, dates });
  }

  return {
    scheduledEntries,
    scheduledLineItemCount: scheduledEntries.length,
    unscheduledLineItemCount,
  };
}

function buildSharedEntries(input: SharedScheduleInput): {
  scheduledEntries: NormalizedScheduledEntry[];
  scheduledLineItemCount: number;
  unscheduledLineItemCount: number;
} {
  const scheduledEntries: NormalizedScheduledEntry[] = [];
  let unscheduledLineItemCount = 0;

  for (const entry of input.lineItems) {
    const { item, plan } = entry;
    if (!item.scheduledStart || !item.scheduledEnd) {
      unscheduledLineItemCount += 1;
      continue;
    }

    const dates = listScheduledDates(item.scheduledStart, item.scheduledEnd);
    const phaseSpan = getPhaseSpan(plan, item.buildPhase);
    const validDates = phaseSpan
      ? dates.filter((date) => date >= phaseSpan.start && date <= phaseSpan.end)
      : dates;

    if (validDates.length === 0) {
      unscheduledLineItemCount += 1;
      continue;
    }

    scheduledEntries.push({ item, dates: validDates });
  }

  return {
    scheduledEntries,
    scheduledLineItemCount: scheduledEntries.length,
    unscheduledLineItemCount,
  };
}

export function computeCapacitySummary(plan: Plan): CapacitySummary {
  const entries = buildSinglePlanEntries(plan);
  return computeCapacityFromNormalizedInput({
    calendar: createPlanCapacityCalendar(plan),
    defaultCrewSize: plan.defaultCrewSize,
    scheduledEntries: entries.scheduledEntries,
    scheduledLineItemCount: entries.scheduledLineItemCount,
    unscheduledLineItemCount: entries.unscheduledLineItemCount,
  });
}

export function computeSharedCapacitySummary(input: SharedScheduleInput): CapacitySummary {
  const entries = buildSharedEntries(input);
  return computeCapacityFromNormalizedInput({
    calendar: input.calendar,
    defaultCrewSize: input.defaultCrewSize,
    scheduledEntries: entries.scheduledEntries,
    scheduledLineItemCount: entries.scheduledLineItemCount,
    unscheduledLineItemCount: entries.unscheduledLineItemCount,
  });
}

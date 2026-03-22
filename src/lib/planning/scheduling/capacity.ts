import { BUILD_PHASES } from '../../types';
import type { WorkType } from '../../types';
import type { Plan, WorkCalendarDay } from '../plan-model';
import { getPhaseFields, getPhaseSpan, isPhaseActive, resolvePlanEfficiency, DEFAULT_PLAN_EFFICIENCY } from '../plan-model';
import type { CrewPool } from '../../tags';
import { resolveEffectiveSkillAllocations } from '../../tags';
import { resolveOverSubscriptionFactor, resolveRequiredSkillCrew } from './placement';
import type { SharedScheduleInput } from './shared-schedule-types';
import { getAssignedDates } from './assignment';
import {
  dayAccessHours,
  dayCrewSize,
  generateDefaultWorkCalendarForSpans,
  hasSchedulingCalendar,
} from './work-calendar';
import { getWorkCalendarPhaseSpans, readPhaseDateValues } from './schedule-span';
import {
  computeCapacityFromNormalizedInput,
  type NormalizedScheduledEntry,
} from './capacity-core';

export interface DailyCapacity {
  date: string;
  isWorkDay: boolean;
  requiredPersonHours: number;
  /** Raw crew × access hours (no efficiency factor). */
  rawAvailablePersonHours: number;
  /** Raw capacity × efficiency factor — the plannable amount. */
  effectiveAvailablePersonHours: number;
  /** Access hours per worker for this day (e.g. 8 for 08:00-16:00). */
  accessHours: number;
  /** Available crew from work calendar for this day (physical headcount). */
  availableCrew: number;
  /** Effective available crew after applying efficiency factor (availableCrew × efficiency). */
  effectiveAvailableCrew: number;
  /** Sum of assigned crew across all line items on this day. */
  assignedCrewTotal: number;
  utilization: number | null;
  lineItemCount: number;
  /** Number of phase rows with positive effort on this day. */
  assignedRowCount: number;
  /** Number of phase rows contributing < 2.0h on this day. */
  smallAllocationCount: number;
  /** Sum of positive scheduled effort allocations on this day. */
  allocatedPersonHours: number;
  averageAllocationPersonHours: number | null;
  largestAllocationShare: number | null;
  fragmentationScore: number;
  fragmentationRisk: 'none' | 'moderate' | 'high';
  /** Skill-group task-switching penalty applied to this day's capacity. 1.0 = no penalty. */
  fragmentationFactor: number;
  /** Total required skill headcount across active skills on this day (0 = no crew pool configured). */
  requiredSkillCrew: number;
  isOverAllocated: boolean;
  /** True when assignedCrewTotal > availableCrew. */
  isOverAssignedCrew: boolean;
  /** True when assignedCrewTotal > availableCrew (derived from crew display: assigned/available). */
  isOverWorkerCapacity: boolean;
  /** Assigned crew x access hours -- the person-hours the assigned crew can provide. */
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
  totalRawAvailablePersonHours: number;
  totalEffectiveAvailablePersonHours: number;
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
  /** Days counted as overstaffed for UI warnings (only when utilization < OVER_STAFFED_AMBER_THRESHOLD). */
  overStaffedWarningDayCount: number;
  fragmentedDayCount: number;
  highFragmentationDayCount: number;
}

function createPlanCapacityCalendar(plan: Plan, defaultCrewSizeOverride?: number | null): WorkCalendarDay[] {
  if (hasSchedulingCalendar(plan)) {
    return plan.workCalendar;
  }

  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(plan));
  if (phaseSpans.length === 0) {
    return [];
  }

  const effectiveCrewSize = defaultCrewSizeOverride ?? plan.defaultCrewSize;
  return generateDefaultWorkCalendarForSpans(phaseSpans, effectiveCrewSize);
}

function buildSinglePlanEntries(plan: Plan): {
  scheduledEntries: NormalizedScheduledEntry[];
  scheduledLineItemCount: number;
  unscheduledLineItemCount: number;
} {
  const scheduledEntries: NormalizedScheduledEntry[] = [];
  let unscheduledLineItemCount = 0;

  for (const item of plan.lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      const dates = getAssignedDates(pf);
      if (dates.length === 0) {
        unscheduledLineItemCount += 1;
        continue;
      }

      scheduledEntries.push({ item, phase, dates });
    }
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
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      const dates = getAssignedDates(pf);
      const phaseSpan = getPhaseSpan(plan, phase);
      const validDates = phaseSpan
        ? dates.filter((date) => date >= phaseSpan.start && date <= phaseSpan.end)
        : dates;

      if (validDates.length === 0) {
        unscheduledLineItemCount += 1;
        continue;
      }

      scheduledEntries.push({ item, phase, dates: validDates });
    }
  }

  return {
    scheduledEntries,
    scheduledLineItemCount: scheduledEntries.length,
    unscheduledLineItemCount,
  };
}

export function computeCapacitySummary(
  plan: Plan,
  defaultCrewSizeOverride?: number | null,
  crewPool?: CrewPool,
  workTypes?: Map<string, WorkType>,
): CapacitySummary {
  const effectiveCrewSize = defaultCrewSizeOverride ?? plan.defaultCrewSize;
  const entries = buildSinglePlanEntries(plan);
  const calendar = createPlanCapacityCalendar(plan, effectiveCrewSize);

  let fragmentationFactors: Map<string, number> | undefined;
  let requiredSkillCrews: Map<string, number> | undefined;
  if (workTypes && crewPool) {
    const committed = new Map<string, number>();
    const skillCommitted = new Map<string, Map<string, number>>();
    for (const item of plan.lineItems) {
      const skillTagId = item.workTypeId ? workTypes.get(item.workTypeId)?.skillTagId : undefined;
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;
        for (const [date, hours] of Object.entries(getPhaseFields(item, phase).personHoursByDate ?? {})) {
          committed.set(date, (committed.get(date) ?? 0) + hours);
          if (skillTagId) {
            let dm = skillCommitted.get(skillTagId);
            if (!dm) { dm = new Map(); skillCommitted.set(skillTagId, dm); }
            dm.set(date, (dm.get(date) ?? 0) + hours);
          }
        }
      }
    }
    const taskSwitchingFactor = crewPool.taskSwitchingFactor ?? 0.95;
    const deploymentCappedAllocations = resolveEffectiveSkillAllocations(crewPool.allocations, crewPool.dailyDeployments);
    fragmentationFactors = new Map();
    requiredSkillCrews = new Map();
    for (const day of calendar) {
      if (!day.isWorkDay) continue;
      const accessHours = dayAccessHours(day);
      const availableCrew = dayCrewSize(day, effectiveCrewSize);
      const effectivePool = day.crewComposition ?? deploymentCappedAllocations;
      const ff = resolveOverSubscriptionFactor(
        day.date, accessHours, availableCrew, committed, skillCommitted, effectivePool, taskSwitchingFactor,
      );
      const rsc = resolveRequiredSkillCrew(day.date, accessHours, committed, skillCommitted, effectivePool);
      if (ff < 1) fragmentationFactors.set(day.date, ff);
      if (rsc > 0) requiredSkillCrews.set(day.date, rsc);
    }
    if (fragmentationFactors.size === 0) fragmentationFactors = undefined;
    if (requiredSkillCrews.size === 0) requiredSkillCrews = undefined;
  }

  return computeCapacityFromNormalizedInput({
    calendar,
    defaultCrewSize: effectiveCrewSize,
    efficiency: resolvePlanEfficiency(plan),
    scheduledEntries: entries.scheduledEntries,
    scheduledLineItemCount: entries.scheduledLineItemCount,
    unscheduledLineItemCount: entries.unscheduledLineItemCount,
    fragmentationFactors,
    requiredSkillCrews,
  });
}

export function computeSharedCapacitySummary(input: SharedScheduleInput): CapacitySummary {
  const entries = buildSharedEntries(input);
  return computeCapacityFromNormalizedInput({
    calendar: input.calendar,
    defaultCrewSize: input.defaultCrewSize,
    efficiency: DEFAULT_PLAN_EFFICIENCY,
    scheduledEntries: entries.scheduledEntries,
    scheduledLineItemCount: entries.scheduledLineItemCount,
    unscheduledLineItemCount: entries.unscheduledLineItemCount,
  });
}

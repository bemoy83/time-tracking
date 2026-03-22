import type { BuildPhase } from '../../types';
import {
  getPhaseFields,
  getPlannedPersonHoursForDate,
  type PlanLineItem,
  type WorkCalendarDay,
} from '../plan-model';
import type { CapacitySummary, DailyCapacity } from './capacity';
import { resolveRequiredPersonHoursForPhase } from './auto-schedule';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  dayCrewSize,
  resolveDayEfficiency,
} from './work-calendar';
import { round2, resolveEffectiveAccessHours, getCrewEquivalentForDate } from './capacity-math';

/** Only surface over-staffed (amber) when crew utilization is below this %. Near-full days use default styling. */
export const OVER_STAFFED_AMBER_THRESHOLD = 95;

const FRAGMENTATION_SMALL_ALLOCATION_HOURS = 2;
const FRAGMENTATION_MIN_SURFACED_HOURS = 4;
const FRAGMENTATION_ROW_THRESHOLD_MODERATE = 5;
const FRAGMENTATION_ROW_THRESHOLD_HIGH = 8;
const FRAGMENTATION_SMALL_COUNT_MODERATE = 2;
const FRAGMENTATION_SMALL_COUNT_HIGH = 4;
const FRAGMENTATION_AVERAGE_HOURS_THRESHOLD = 2;
const FRAGMENTATION_LARGEST_SHARE_THRESHOLD = 0.45;

export interface NormalizedScheduledEntry {
  item: PlanLineItem;
  phase: BuildPhase;
  dates: string[];
}

export interface CapacityComputationInput {
  calendar: WorkCalendarDay[];
  defaultCrewSize: number | null;
  /** Efficiency factor 0.5–1.0. Defaults to 1.0 if omitted. */
  efficiency?: number;
  scheduledEntries: NormalizedScheduledEntry[];
  unscheduledLineItemCount: number;
  scheduledLineItemCount: number;
  /** Per-day fragmentation penalty factors (date → factor ≤ 1.0). Applied to effective available hours. */
  fragmentationFactors?: Map<string, number>;
  /** Per-day skill group counts (date → count). Stored in DailyCapacity for tooltip display. */
  fragmentationGroupCounts?: Map<string, number>;
}

type FragmentationRisk = DailyCapacity['fragmentationRisk'];

interface DayAccumulator {
  date: string;
  isWorkDay: boolean;
  rawAvailablePersonHours: number;
  effectiveAvailablePersonHours: number;
  fragmentationFactor: number;
  skillGroupCount: number;
  accessHours: number;
  availableCrew: number;
  effectiveAvailableCrew: number;
  assignedCrewTotal: number;
  lineItemCount: number;
  assignedRowCount: number;
  smallAllocationCount: number;
  allocatedPersonHours: number;
  requiredPersonHours: number;
  assignedCapacityPersonHours: number;
  isCompletionDay: boolean;
  needToMeetTargetPersonHours: number;
  shortfallPersonHours: number;
  largestAllocationPersonHours: number;
}

function computeFragmentationScore(day: Pick<
  DailyCapacity,
  'assignedRowCount' | 'smallAllocationCount' | 'averageAllocationPersonHours' | 'largestAllocationShare'
>): number {
  let score = 0;
  if (day.assignedRowCount >= FRAGMENTATION_ROW_THRESHOLD_MODERATE) score += 1;
  if (day.assignedRowCount >= FRAGMENTATION_ROW_THRESHOLD_HIGH) score += 1;
  if (day.smallAllocationCount >= FRAGMENTATION_SMALL_COUNT_MODERATE) score += 1;
  if (day.smallAllocationCount >= FRAGMENTATION_SMALL_COUNT_HIGH) score += 1;
  if (
    day.averageAllocationPersonHours != null
    && day.averageAllocationPersonHours < FRAGMENTATION_AVERAGE_HOURS_THRESHOLD
  ) {
    score += 1;
  }
  if (
    day.largestAllocationShare != null
    && day.largestAllocationShare < FRAGMENTATION_LARGEST_SHARE_THRESHOLD
    && day.assignedRowCount >= 4
  ) {
    score += 1;
  }
  return score;
}

function mapFragmentationRisk(score: number): FragmentationRisk {
  if (score >= 4) return 'high';
  if (score >= 2) return 'moderate';
  return 'none';
}

function createDayAccumulator(
  day: WorkCalendarDay,
  defaultCrewSize: number | null,
  planEfficiency: number,
  fragmentationFactor = 1,
  skillGroupCount = 1,
): DayAccumulator {
  const dayEfficiency = resolveDayEfficiency(day, planEfficiency);
  const rawAvailablePersonHours = round2(dayAvailablePersonHours(day, defaultCrewSize));
  const effectiveAvailablePersonHours = round2(rawAvailablePersonHours * dayEfficiency * fragmentationFactor);
  const availableCrew = dayCrewSize(day, defaultCrewSize);

  return {
    date: day.date,
    isWorkDay: day.isWorkDay,
    rawAvailablePersonHours,
    effectiveAvailablePersonHours,
    fragmentationFactor,
    skillGroupCount,
    accessHours: dayAccessHours(day),
    availableCrew,
    effectiveAvailableCrew: round2(availableCrew * dayEfficiency),
    assignedCrewTotal: 0,
    lineItemCount: 0,
    assignedRowCount: 0,
    smallAllocationCount: 0,
    allocatedPersonHours: 0,
    requiredPersonHours: 0,
    assignedCapacityPersonHours: 0,
    isCompletionDay: false,
    needToMeetTargetPersonHours: 0,
    shortfallPersonHours: 0,
    largestAllocationPersonHours: 0,
  };
}

function createDayAccumulatorMap(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
  planEfficiency: number,
  fragmentationFactors?: Map<string, number>,
  fragmentationGroupCounts?: Map<string, number>,
): Map<string, DayAccumulator> {
  const dayMap = new Map<string, DayAccumulator>();
  for (const day of calendar) {
    const ff = fragmentationFactors?.get(day.date) ?? 1;
    const gc = fragmentationGroupCounts?.get(day.date) ?? 1;
    dayMap.set(day.date, createDayAccumulator(day, defaultCrewSize, planEfficiency, ff, gc));
  }
  return dayMap;
}

function resolveShortfallTargetDay(
  dayMap: Map<string, DayAccumulator>,
  dates: string[],
  fallback: DayAccumulator,
): DayAccumulator {
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const candidate = dayMap.get(dates[i]);
    if (candidate?.isWorkDay) return candidate;
  }
  return fallback;
}

function accumulateScheduledEntry(
  dayMap: Map<string, DayAccumulator>,
  entry: NormalizedScheduledEntry,
): void {
  const { item, phase, dates } = entry;
  const phaseFields = getPhaseFields(item, phase);
  const totalPersonHours = resolveRequiredPersonHoursForPhase(item, phase) ?? (phaseFields.timeHours * phaseFields.crew);
  const lastDate = dates[dates.length - 1];
  let scheduledTotal = 0;

  for (const date of dates) {
    const day = dayMap.get(date);
    if (!day) continue;

    const plannedPersonHours = getPlannedPersonHoursForDate(item, phase, date);
    const effectiveAccessHours = resolveEffectiveAccessHours(
      day.effectiveAvailablePersonHours,
      day.availableCrew,
      day.accessHours,
    );
    const crewEquivalent = day.isWorkDay
      ? getCrewEquivalentForDate(item, phase, date, effectiveAccessHours)
      : 0;

    if (day.isWorkDay && crewEquivalent > 0) {
      day.assignedCrewTotal = round2(day.assignedCrewTotal + crewEquivalent);
    }

    day.lineItemCount += 1;

    if (day.isWorkDay && plannedPersonHours > 0) {
      day.assignedCapacityPersonHours += plannedPersonHours;
      day.allocatedPersonHours += plannedPersonHours;
      day.assignedRowCount += 1;
      if (plannedPersonHours < FRAGMENTATION_SMALL_ALLOCATION_HOURS) {
        day.smallAllocationCount += 1;
      }
      day.largestAllocationPersonHours = Math.max(day.largestAllocationPersonHours, plannedPersonHours);
    }

    if (plannedPersonHours <= 0) continue;

    day.requiredPersonHours += plannedPersonHours;
    scheduledTotal += plannedPersonHours;

    if (date === lastDate && totalPersonHours - scheduledTotal > 0.01) {
      const targetDay = day.isWorkDay
        ? day
        : resolveShortfallTargetDay(dayMap, dates, day);
      targetDay.needToMeetTargetPersonHours += totalPersonHours - (scheduledTotal - plannedPersonHours);
      targetDay.shortfallPersonHours += totalPersonHours - scheduledTotal;
    }
  }

  const lastDay = dayMap.get(lastDate);
  if (lastDay) lastDay.isCompletionDay = true;
}

function deriveDailyCapacity(day: DayAccumulator): DailyCapacity {
  const requiredPersonHours = round2(day.requiredPersonHours);
  const rawAvailablePersonHours = round2(day.rawAvailablePersonHours);
  const effectiveAvailablePersonHours = round2(day.effectiveAvailablePersonHours);
  const assignedCapacityPersonHours = round2(day.assignedCapacityPersonHours);
  const allocatedPersonHours = round2(day.allocatedPersonHours);
  const averageAllocationPersonHours = day.assignedRowCount > 0
    ? round2(allocatedPersonHours / day.assignedRowCount)
    : null;
  const largestAllocationShare = allocatedPersonHours > 0
    ? round2(day.largestAllocationPersonHours / allocatedPersonHours)
    : null;
  const fragmentationScore = computeFragmentationScore({
    assignedRowCount: day.assignedRowCount,
    smallAllocationCount: day.smallAllocationCount,
    averageAllocationPersonHours,
    largestAllocationShare,
  });
  const fragmentationRisk = allocatedPersonHours >= FRAGMENTATION_MIN_SURFACED_HOURS
    ? mapFragmentationRisk(fragmentationScore)
    : 'none';
  const utilization = effectiveAvailablePersonHours > 0
    ? round2(requiredPersonHours / effectiveAvailablePersonHours)
    : null;
  const isOverAssignedCrew = day.isWorkDay && day.assignedCrewTotal > day.availableCrew + 0.01;
  const isOverWorkerCapacity = isOverAssignedCrew;
  const needToMeetTargetPersonHours = round2(day.needToMeetTargetPersonHours || 0);
  const shortfallPersonHours = round2(day.shortfallPersonHours || 0);
  const isOverStaffed = day.isWorkDay
    && requiredPersonHours > 0.01
    && day.assignedCrewTotal < day.availableCrew - 0.01;

  return {
    date: day.date,
    isWorkDay: day.isWorkDay,
    requiredPersonHours,
    rawAvailablePersonHours,
    effectiveAvailablePersonHours,
    fragmentationFactor: day.fragmentationFactor,
    skillGroupCount: day.skillGroupCount,
    accessHours: day.accessHours,
    availableCrew: day.availableCrew,
    effectiveAvailableCrew: day.effectiveAvailableCrew,
    assignedCrewTotal: day.assignedCrewTotal,
    utilization,
    lineItemCount: day.lineItemCount,
    assignedRowCount: day.assignedRowCount,
    smallAllocationCount: day.smallAllocationCount,
    allocatedPersonHours,
    averageAllocationPersonHours,
    largestAllocationShare,
    fragmentationScore,
    fragmentationRisk,
    isOverAllocated: effectiveAvailablePersonHours > 0
      ? requiredPersonHours > effectiveAvailablePersonHours
      : requiredPersonHours > 0,
    isOverAssignedCrew,
    isOverWorkerCapacity,
    assignedCapacityPersonHours,
    isCompletionDay: day.isCompletionDay,
    needToMeetTargetPersonHours,
    shortfallPersonHours,
    isOverStaffed,
  };
}

function summarizeCapacity(
  days: DailyCapacity[],
  unscheduledLineItemCount: number,
  scheduledLineItemCount: number,
): CapacitySummary {
  const totalRequiredPersonHours = round2(days.reduce((sum, day) => sum + day.requiredPersonHours, 0));
  const totalRawAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.rawAvailablePersonHours, 0));
  const totalEffectiveAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.effectiveAvailablePersonHours, 0));
  const headroomPersonHours = round2(totalEffectiveAvailablePersonHours - totalRequiredPersonHours);
  const overAllocatedDayCount = days.filter((day) => day.isOverAllocated).length;
  const overAssignedCrewDayCount = days.filter((day) => day.isOverAssignedCrew).length;
  const overWorkerCapacityDayCount = days.filter((day) => day.isOverWorkerCapacity).length;
  const overStaffedDayCount = days.filter((day) => day.isOverStaffed).length;
  const overStaffedWarningDayCount = days.filter((day) => {
    if (!day.isOverStaffed || day.availableCrew <= 0) return false;
    const utilizationPct = (day.assignedCrewTotal / day.availableCrew) * 100;
    return utilizationPct < OVER_STAFFED_AMBER_THRESHOLD;
  }).length;
  const fragmentedDayCount = days.filter((day) => day.fragmentationRisk !== 'none').length;
  const highFragmentationDayCount = days.filter((day) => day.fragmentationRisk === 'high').length;

  return {
    days,
    totalRequiredPersonHours,
    totalRawAvailablePersonHours,
    totalEffectiveAvailablePersonHours,
    headroomPersonHours,
    overAllocatedDayCount,
    overAssignedCrewDayCount,
    overWorkerCapacityDayCount,
    unscheduledLineItemCount,
    scheduledLineItemCount,
    overStaffedDayCount,
    overStaffedWarningDayCount,
    fragmentedDayCount,
    highFragmentationDayCount,
  };
}

export function computeCapacityFromNormalizedInput(
  input: CapacityComputationInput,
): CapacitySummary {
  const efficiency = input.efficiency ?? 1.0;
  const dayMap = createDayAccumulatorMap(input.calendar, input.defaultCrewSize, efficiency, input.fragmentationFactors, input.fragmentationGroupCounts);

  for (const entry of input.scheduledEntries) {
    accumulateScheduledEntry(dayMap, entry);
  }

  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(deriveDailyCapacity);

  return summarizeCapacity(
    days,
    input.unscheduledLineItemCount,
    input.scheduledLineItemCount,
  );
}

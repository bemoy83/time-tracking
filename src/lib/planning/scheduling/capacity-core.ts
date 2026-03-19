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
}

type FragmentationRisk = DailyCapacity['fragmentationRisk'];
type InternalDailyCapacity = DailyCapacity & {
  largestAllocationPersonHours: number;
};

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

function buildDayMapFromCalendar(
  calendar: WorkCalendarDay[],
  defaultCrewSize: number | null,
  planEfficiency: number,
): Map<string, InternalDailyCapacity> {
  const dayMap = new Map<string, InternalDailyCapacity>();
  for (const day of calendar) {
    const dayEfficiency = resolveDayEfficiency(day, planEfficiency);
    const raw = dayAvailablePersonHours(day, defaultCrewSize);
    const effective = round2(raw * dayEfficiency);
    const crew = dayCrewSize(day, defaultCrewSize);
    const access = dayAccessHours(day);
    dayMap.set(day.date, {
      date: day.date,
      isWorkDay: day.isWorkDay,
      requiredPersonHours: 0,
      availablePersonHours: effective,
      rawAvailablePersonHours: round2(raw),
      effectiveAvailablePersonHours: effective,
      accessHours: access,
      availableCrew: crew,
      effectiveAvailableCrew: round2(crew * dayEfficiency),
      assignedCrewTotal: 0,
      utilization: effective > 0 ? 0 : null,
      lineItemCount: 0,
      assignedRowCount: 0,
      smallAllocationCount: 0,
      allocatedPersonHours: 0,
      averageAllocationPersonHours: null,
      largestAllocationShare: null,
      fragmentationScore: 0,
      fragmentationRisk: 'none',
      isOverAllocated: false,
      isOverAssignedCrew: false,
      isOverWorkerCapacity: false,
      assignedCapacityPersonHours: 0,
      isCompletionDay: false,
      needToMeetTargetPersonHours: 0,
      shortfallPersonHours: 0,
      isOverStaffed: false,
      largestAllocationPersonHours: 0,
    });
  }
  return dayMap;
}

function applyScheduledItem(
  dayMap: Map<string, InternalDailyCapacity>,
  item: PlanLineItem,
  phase: BuildPhase,
  dates: string[],
): void {
  const pf = getPhaseFields(item, phase);
  const totalPersonHours = resolveRequiredPersonHoursForPhase(item, phase) ?? (pf.timeHours * pf.crew);
  let scheduledTotal = 0;
  const lastDate = dates[dates.length - 1];

  for (const date of dates) {
    const day = dayMap.get(date);
    if (!day) continue;
    const plannedPersonHours = getPlannedPersonHoursForDate(item, phase, date);
    // resolveEffectiveAccessHours = effectiveAvailablePersonHours / availableCrew
    // = accessHours × dayEfficiency, so full effective utilization → crew/crew.
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
    // Accumulate actual person-hours directly (decoupled from inflated crewEquivalent)
    if (day.isWorkDay && plannedPersonHours > 0) {
      day.assignedCapacityPersonHours += plannedPersonHours;
      day.allocatedPersonHours += plannedPersonHours;
      day.assignedRowCount += 1;
      if (plannedPersonHours < FRAGMENTATION_SMALL_ALLOCATION_HOURS) {
        day.smallAllocationCount += 1;
      }
      day.largestAllocationPersonHours = Math.max(day.largestAllocationPersonHours, plannedPersonHours);
    }
    day.lineItemCount += 1;

    if (plannedPersonHours <= 0) continue;
    day.requiredPersonHours += plannedPersonHours;
    scheduledTotal += plannedPersonHours;

    if (date === lastDate && totalPersonHours - scheduledTotal > 0.01) {
      // Only accumulate shortfall on work days so the badge displays it
      const targetDay = day.isWorkDay ? day : (() => {
        for (let i = dates.length - 1; i >= 0; i--) {
          const d = dayMap.get(dates[i]);
          if (d?.isWorkDay) return d;
        }
        return day;
      })();
      targetDay.needToMeetTargetPersonHours += totalPersonHours - (scheduledTotal - plannedPersonHours);
      targetDay.shortfallPersonHours += totalPersonHours - scheduledTotal;
    }
  }

  const lastDay = dayMap.get(lastDate);
  if (lastDay) lastDay.isCompletionDay = true;
}

function finalizeCapacitySummary(
  dayMap: Map<string, InternalDailyCapacity>,
  unscheduledLineItemCount: number,
  scheduledLineItemCount: number,
): CapacitySummary {
  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const { largestAllocationPersonHours: _largestAllocationPersonHours, ...rest } = day;
      const required = round2(day.requiredPersonHours);
      const effective = round2(day.effectiveAvailablePersonHours);
      const raw = round2(day.rawAvailablePersonHours);
      const utilization = effective > 0 ? round2(required / effective) : null;
      const isOverAssignedCrew = day.isWorkDay && day.assignedCrewTotal > day.availableCrew + 0.01;
      const isOverWorkerCapacity = isOverAssignedCrew; // Derived from crew display (assigned/available)
      // Use directly accumulated person-hours (not recomputed from inflated crewEquivalent)
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
      const needToMeetTargetPersonHours = round2(day.needToMeetTargetPersonHours || 0);
      const shortfallPersonHours = round2(day.shortfallPersonHours || 0);
      const isOverStaffed = day.isWorkDay && required > 0.01 && day.assignedCrewTotal < day.availableCrew - 0.01;
      return {
        ...rest,
        requiredPersonHours: required,
        availablePersonHours: effective,
        rawAvailablePersonHours: raw,
        effectiveAvailablePersonHours: effective,
        utilization,
        allocatedPersonHours,
        averageAllocationPersonHours,
        largestAllocationShare,
        fragmentationScore,
        fragmentationRisk,
        isOverAllocated: effective > 0 ? required > effective : required > 0,
        isOverAssignedCrew,
        isOverWorkerCapacity,
        assignedCapacityPersonHours,
        needToMeetTargetPersonHours,
        shortfallPersonHours,
        isOverStaffed,
      };
    });

  const totalRequiredPersonHours = round2(days.reduce((sum, day) => sum + day.requiredPersonHours, 0));
  const totalRawAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.rawAvailablePersonHours, 0));
  const totalEffectiveAvailablePersonHours = round2(days.reduce((sum, day) => sum + day.effectiveAvailablePersonHours, 0));
  const totalAvailablePersonHours = totalEffectiveAvailablePersonHours;
  const headroomPersonHours = round2(totalEffectiveAvailablePersonHours - totalRequiredPersonHours);
  const overAllocatedDayCount = days.filter((day) => day.isOverAllocated).length;
  const overAssignedCrewDayCount = days.filter((day) => day.isOverAssignedCrew).length;
  const overWorkerCapacityDayCount = days.filter((day) => day.isOverWorkerCapacity).length;
  const overStaffedDayCount = days.filter((day) => day.isOverStaffed).length;
  const fragmentedDayCount = days.filter((day) => day.fragmentationRisk !== 'none').length;
  const highFragmentationDayCount = days.filter((day) => day.fragmentationRisk === 'high').length;

  return {
    days,
    totalRequiredPersonHours,
    totalAvailablePersonHours,
    totalRawAvailablePersonHours,
    totalEffectiveAvailablePersonHours,
    headroomPersonHours,
    overAllocatedDayCount,
    overAssignedCrewDayCount,
    overWorkerCapacityDayCount,
    unscheduledLineItemCount,
    scheduledLineItemCount,
    overStaffedDayCount,
    fragmentedDayCount,
    highFragmentationDayCount,
  };
}

export function computeCapacityFromNormalizedInput(
  input: CapacityComputationInput,
): CapacitySummary {
  const efficiency = input.efficiency ?? 1.0;
  const dayMap = buildDayMapFromCalendar(input.calendar, input.defaultCrewSize, efficiency);

  for (const entry of input.scheduledEntries) {
    applyScheduledItem(dayMap, entry.item, entry.phase, entry.dates);
  }

  return finalizeCapacitySummary(
    dayMap,
    input.unscheduledLineItemCount,
    input.scheduledLineItemCount,
  );
}

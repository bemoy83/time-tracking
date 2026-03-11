/**
 * Shared schedule assistant: place unscheduled phase rows across multiple plans
 * against a shared crew-pool calendar. Maximizes total covered person-hours globally
 * with deterministic tie-break ordering.
 */

import type { BuildPhase } from '../../types';
import { BUILD_PHASES } from '../../types';
import type { Plan, PlanLineItem, PhaseFields, WorkCalendarDay } from '../plan-model';
import {
  getPhaseFields,
  getPhaseQuantity,
  getPhaseSpan,
  isPhaseActive,
  phaseFieldUpdates,
  updatePlanLineItem,
} from '../plan-model';
import { dayAccessHours, dayCrewSize, listDateRange } from './work-calendar';
import { computeSharedCapacitySummary } from './capacity';
import type { ScheduledLineItemRef } from './shared-schedule-types';
import {
  resolveRequiredPersonHoursForPhase,
  type AutoScheduleOptions,
  type AutoScheduleMetrics,
  type AutoScheduleUnresolvedReason,
} from './auto-schedule';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedAutoScheduleInput {
  plans: Plan[];
  calendar: WorkCalendarDay[];
  defaultCrewSize: number;
}

export interface SharedAutoScheduleChangedRow {
  planId: string;
  lineItemId: string;
  phase: BuildPhase;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface SharedAutoScheduleUnresolvedRow {
  planId: string;
  lineItemId: string;
  phase: BuildPhase;
  reason: AutoScheduleUnresolvedReason;
  requiredPH: number;
  assignedPH: number;
}

export interface SharedAutoScheduleReport {
  changed: SharedAutoScheduleChangedRow[];
  unresolved: SharedAutoScheduleUnresolvedRow[];
  before: AutoScheduleMetrics;
  after: AutoScheduleMetrics;
}

export interface SharedAutoScheduleResult {
  planUpdatesById: Map<string, Plan>;
  report: SharedAutoScheduleReport;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type RequiredWorkMode = 'time_hours_first' | 'rate_first';

interface NormalizedOptions {
  requiredWorkMode: RequiredWorkMode;
  rebalance: 'none' | 'local';
  includeScheduled: boolean;
  allowOverAllocation: boolean;
}

interface DayState {
  date: string;
  accessHours: number;
  totalCrew: number;
  remainingCrew: number;
}

interface RequiredWorkResolution {
  requiredPH: number | null;
  source: 'time' | 'rate' | null;
}

interface SharedCandidateItem {
  planId: string;
  item: PlanLineItem;
  pf: PhaseFields;
  phase: BuildPhase;
  requiredPH: number;
  requestedCrew: number;
  source: 'time' | 'rate';
  candidateDayIndices: number[];
}

interface Placement {
  startDate: string;
  endDate: string;
  startIndex: number;
  endIndex: number;
  spanLength: number;
  assignedPH: number;
  crewByDate: Record<string, number>;
  maxCrewUsed: number;
  covers: boolean;
}

interface ScheduledRowState {
  planId: string;
  lineItemId: string;
  phase: BuildPhase;
  requiredPH: number;
  requestedCrew: number;
  source: 'time' | 'rate';
  candidateDays: DayState[];
  placement: Placement;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: NormalizedOptions = {
  requiredWorkMode: 'time_hours_first',
  rebalance: 'local',
  includeScheduled: false,
  allowOverAllocation: false,
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeOptions(options?: AutoScheduleOptions): NormalizedOptions {
  return {
    requiredWorkMode: options?.requiredWorkMode ?? DEFAULT_OPTIONS.requiredWorkMode,
    rebalance: options?.rebalance ?? DEFAULT_OPTIONS.rebalance,
    includeScheduled: options?.includeScheduled ?? DEFAULT_OPTIONS.includeScheduled,
    allowOverAllocation: options?.allowOverAllocation ?? DEFAULT_OPTIONS.allowOverAllocation,
  };
}

function getUsableCrew(
  requestedCrew: number,
  remainingCrew: number,
  allowOverAllocation: boolean,
): number {
  if (allowOverAllocation) return Math.max(0, requestedCrew);
  return Math.max(0, Math.min(requestedCrew, remainingCrew));
}

function resolveRequiredWork(
  item: PlanLineItem,
  phase: BuildPhase,
  mode: RequiredWorkMode,
): RequiredWorkResolution {
  const pf = getPhaseFields(item, phase);
  const quantity = getPhaseQuantity(item, phase);

  const fromTime = (): RequiredWorkResolution => {
    if (pf.timeHours > 0 && pf.crew > 0) {
      return { requiredPH: pf.timeHours * pf.crew, source: 'time' };
    }
    if (pf.rate > 0 && quantity > 0) {
      return { requiredPH: quantity / pf.rate, source: 'rate' };
    }
    return { requiredPH: null, source: null };
  };

  const fromRate = (): RequiredWorkResolution => {
    if (pf.rate > 0 && quantity > 0) {
      return { requiredPH: quantity / pf.rate, source: 'rate' };
    }
    if (pf.timeHours > 0 && pf.crew > 0) {
      return { requiredPH: pf.timeHours * pf.crew, source: 'time' };
    }
    return { requiredPH: null, source: null };
  };

  return mode === 'rate_first' ? fromRate() : fromTime();
}

function sameCrewByDate(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): boolean {
  const aKeys = Object.keys(a ?? {}).sort();
  const bKeys = Object.keys(b ?? {}).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if ((a ?? {})[aKeys[i]] !== (b ?? {})[bKeys[i]]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Placement simulation (mirrors single-plan engine)
// ---------------------------------------------------------------------------

function simulatePlacement(
  candidates: DayState[],
  startIndex: number,
  requiredPH: number,
  requestedCrew: number,
  allowOverAllocation: boolean,
  availableByDate?: Map<string, number>,
): Placement | null {
  const crewByDate: Record<string, number> = {};
  let phLeft = requiredPH;
  let assignedPH = 0;
  let lastIndex = startIndex;

  for (let i = startIndex; i < candidates.length; i++) {
    lastIndex = i;
    const day = candidates[i];
    const remainingCrew = availableByDate?.get(day.date) ?? day.remainingCrew;
    const usableCrew = getUsableCrew(requestedCrew, remainingCrew, allowOverAllocation);
    if (usableCrew <= 0 || day.accessHours <= 0) continue;

    const dayPH = usableCrew * day.accessHours;
    const delivered = Math.min(dayPH, phLeft);
    if (delivered <= 0) continue;

    const crewThisDay = Math.max(1, Math.min(usableCrew, Math.ceil(delivered / day.accessHours)));
    crewByDate[day.date] = crewThisDay;
    assignedPH += delivered;
    phLeft -= delivered;

    if (phLeft <= 0.01) break;
  }

  const assignedDates = Object.keys(crewByDate).sort();
  if (assignedDates.length === 0) return null;

  const covers = phLeft <= 0.01;
  const maxCrewUsed = Math.max(...Object.values(crewByDate));
  const endDate = assignedDates[assignedDates.length - 1];
  const endIndex = candidates.findIndex((d) => d.date === endDate);

  return {
    startDate: assignedDates[0],
    endDate,
    startIndex,
    endIndex: endIndex >= 0 ? endIndex : lastIndex,
    spanLength: (endIndex >= 0 ? endIndex : lastIndex) - startIndex + 1,
    assignedPH: round2(assignedPH),
    crewByDate,
    maxCrewUsed,
    covers,
  };
}

function isPlacementBetter(a: Placement, b: Placement): boolean {
  if (a.covers !== b.covers) return a.covers;
  if (!a.covers && !b.covers && a.assignedPH !== b.assignedPH) return a.assignedPH > b.assignedPH;
  if (a.spanLength !== b.spanLength) return a.spanLength < b.spanLength;
  return a.startDate < b.startDate;
}

function applyPlacementToDayState(
  dayStateMap: Map<string, DayState>,
  crewByDate: Record<string, number>,
  multiplier: 1 | -1,
): void {
  for (const [date, crew] of Object.entries(crewByDate)) {
    const day = dayStateMap.get(date);
    if (!day) continue;
    day.remainingCrew -= crew * multiplier;
  }
}

function overCapacityViolationCount(
  placement: Placement,
  availableByDate: Map<string, number>,
): number {
  let violations = 0;
  for (const [date, crew] of Object.entries(placement.crewByDate)) {
    const available = availableByDate.get(date) ?? 0;
    if (crew > available) violations += 1;
  }
  return violations;
}

function isLocalObjectiveBetter(
  candidate: { covered: number; violations: number; spanLength: number; startDate: string },
  current: { covered: number; violations: number; spanLength: number; startDate: string },
): boolean {
  if (candidate.covered !== current.covered) return candidate.covered > current.covered;
  if (candidate.violations !== current.violations) return candidate.violations < current.violations;
  if (candidate.spanLength !== current.spanLength) return candidate.spanLength < current.spanLength;
  return candidate.startDate < current.startDate;
}

// ---------------------------------------------------------------------------
// Shared metrics
// ---------------------------------------------------------------------------

function computeSharedMetrics(
  plans: Plan[],
  calendar: WorkCalendarDay[],
  defaultCrewSize: number,
  mode: RequiredWorkMode,
): AutoScheduleMetrics {
  let requiredPH = 0;
  let coveredPH = 0;

  for (const plan of plans) {
    const dayByDate = new Map(calendar.map((d) => [d.date, d]));

    for (const item of plan.lineItems) {
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;
        const required = resolveRequiredPersonHoursForPhase(item, phase, mode);
        if (required == null || required <= 0) continue;
        requiredPH += required;

        const pf = getPhaseFields(item, phase);
        if (!pf.scheduledStart || !pf.scheduledEnd) continue;

        const dates = listDateRange(pf.scheduledStart, pf.scheduledEnd);
        let remaining = required;
        let covered = 0;

        for (const date of dates) {
          if (remaining <= 0.01) break;
          const day = dayByDate.get(date);
          if (!day || !day.isWorkDay) continue;
          const accessHours = dayAccessHours(day);
          if (accessHours <= 0) continue;
          const crew = pf.crewByDate?.[date] ?? pf.crew;
          if (crew <= 0) continue;
          const dayPH = crew * accessHours;
          const delivered = Math.min(dayPH, remaining);
          remaining -= delivered;
          covered += delivered;
        }

        coveredPH += covered;
      }
    }
  }

  const lineItemRefs: ScheduledLineItemRef[] = [];
  for (const plan of plans) {
    for (const item of plan.lineItems) {
      lineItemRefs.push({
        planId: plan.id,
        lineItemId: item.id,
        plan,
        item,
        readOnly: false,
      });
    }
  }
  const capacity = computeSharedCapacitySummary({
    calendar,
    defaultCrewSize,
    lineItems: lineItemRefs,
  });

  return {
    requiredPersonHours: round2(requiredPH),
    coveredPersonHours: round2(coveredPH),
    coverageRatio: requiredPH > 0 ? round2(coveredPH / requiredPH) : 1,
    overCapacityDays: capacity.overWorkerCapacityDayCount,
  };
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

export function runSharedAutoSchedule(
  input: SharedAutoScheduleInput,
  options?: AutoScheduleOptions,
): SharedAutoScheduleResult {
  const { plans, calendar, defaultCrewSize } = input;
  const normalized = normalizeOptions(options);

  const before = computeSharedMetrics(plans, calendar, defaultCrewSize, normalized.requiredWorkMode);

  // Build global day state from shared crew-pool calendar
  const workDays = calendar.filter((d) => d.isWorkDay);
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

  // Account for already-scheduled rows across all plans
  if (!normalized.includeScheduled) {
    for (const plan of plans) {
      for (const item of plan.lineItems) {
        for (const phase of BUILD_PHASES) {
          if (!isPhaseActive(item, phase)) continue;
          const pf = getPhaseFields(item, phase);
          if (!pf.scheduledStart || !pf.scheduledEnd) continue;
          for (const [date, dayState] of dayStateMap) {
            if (date < pf.scheduledStart || date > pf.scheduledEnd) continue;
            const crew = pf.crewByDate ? (pf.crewByDate[date] ?? 0) : pf.crew;
            dayState.remainingCrew -= crew;
          }
        }
      }
    }
  }

  // Build candidate items across all plans and phases
  const allCandidates: SharedCandidateItem[] = [];
  const unresolved: SharedAutoScheduleUnresolvedRow[] = [];

  for (const plan of plans) {
    for (const item of plan.lineItems) {
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;

        // Skip already-scheduled rows
        if (!normalized.includeScheduled) {
          const pf = getPhaseFields(item, phase);
          if (pf.scheduledStart && pf.scheduledEnd) continue;
        }

        const pf = getPhaseFields(item, phase);
        const required = resolveRequiredWork(item, phase, normalized.requiredWorkMode);

        if (required.requiredPH == null || required.requiredPH <= 0 || required.source == null) {
          unresolved.push({
            planId: plan.id,
            lineItemId: item.id,
            phase,
            reason: 'missing_required_hours',
            requiredPH: 0,
            assignedPH: 0,
          });
          continue;
        }

        // Determine candidate days restricted to this row's phase window
        const phaseSpan = getPhaseSpan(plan, phase);
        const candidateDayIndices: number[] = [];
        const allWorkDayDates = workDays.map((d) => d.date);

        for (let i = 0; i < allWorkDayDates.length; i++) {
          const date = allWorkDayDates[i];
          if (phaseSpan && (date < phaseSpan.start || date > phaseSpan.end)) continue;
          candidateDayIndices.push(i);
        }

        if (candidateDayIndices.length === 0) {
          unresolved.push({
            planId: plan.id,
            lineItemId: item.id,
            phase,
            reason: 'no_work_days',
            requiredPH: round2(required.requiredPH),
            assignedPH: 0,
          });
          continue;
        }

        allCandidates.push({
          planId: plan.id,
          item,
          pf,
          phase,
          requiredPH: required.requiredPH,
          requestedCrew: pf.crew > 0 ? pf.crew : 1,
          source: required.source,
          candidateDayIndices,
        });
      }
    }
  }

  // Sort candidates: deterministic tie-break per plan spec
  // Primary: higher required PH first
  // Secondary: smaller span (candidateDayIndices.length) for tighter windows
  // Final: lexical planId, lineItemId, phase, earliest start
  allCandidates.sort((a, b) => {
    // Primary: higher required PH
    if (b.requiredPH !== a.requiredPH) return b.requiredPH - a.requiredPH;
    // Secondary: smaller candidate window first
    if (a.candidateDayIndices.length !== b.candidateDayIndices.length) {
      return a.candidateDayIndices.length - b.candidateDayIndices.length;
    }
    // Final tie-break: lexical planId, lineItemId, phase, earliest start
    if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
    if (a.item.id !== b.item.id) return a.item.id.localeCompare(b.item.id);
    if (a.phase !== b.phase) return a.phase.localeCompare(b.phase);
    const aStart = a.candidateDayIndices[0] ?? 0;
    const bStart = b.candidateDayIndices[0] ?? 0;
    return aStart - bStart;
  });

  // Build per-candidate day states (subset of global workDays)
  const workDaysList = workDays.map((d) => dayStateMap.get(d.date)!).filter(Boolean);

  // Track plan mutations
  const planUpdatesById = new Map<string, Plan>();
  for (const plan of plans) {
    planUpdatesById.set(plan.id, plan);
  }

  const changed: SharedAutoScheduleChangedRow[] = [];
  const scheduledRows: ScheduledRowState[] = [];

  // Greedy placement
  for (const candidate of allCandidates) {
    const candidateDays = candidate.candidateDayIndices.map((i) => workDaysList[i]).filter(Boolean);
    if (candidateDays.length === 0) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'no_work_days',
        requiredPH: round2(candidate.requiredPH),
        assignedPH: 0,
      });
      continue;
    }

    let best: Placement | null = null;

    for (let start = 0; start < candidateDays.length; start++) {
      const placement = simulatePlacement(
        candidateDays,
        start,
        candidate.requiredPH,
        candidate.requestedCrew,
        normalized.allowOverAllocation,
      );
      if (!placement) continue;
      if (!best || isPlacementBetter(placement, best)) {
        best = placement;
      }
    }

    if (!best) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'no_capacity_window',
        requiredPH: round2(candidate.requiredPH),
        assignedPH: 0,
      });
      continue;
    }

    // Commit placement to global day state
    applyPlacementToDayState(dayStateMap, best.crewByDate, 1);

    // Apply to plan
    let currentPlan = planUpdatesById.get(candidate.planId)!;
    const updates: Partial<PhaseFields> = {
      scheduledStart: best.startDate,
      scheduledEnd: best.endDate,
      crewByDate: best.crewByDate,
    };
    if (candidate.pf.crew <= 0) {
      updates.crew = best.maxCrewUsed;
    }
    if (candidate.pf.timeHours <= 0 && candidate.source === 'rate' && best.maxCrewUsed > 0) {
      updates.timeHours = round2(candidate.requiredPH / best.maxCrewUsed);
    }

    currentPlan = updatePlanLineItem(currentPlan, candidate.item.id, phaseFieldUpdates(candidate.phase, updates));
    planUpdatesById.set(candidate.planId, currentPlan);

    // Track changes
    const previous = getPhaseFields(candidate.item, candidate.phase);
    const scheduleChanged =
      previous.scheduledStart !== best.startDate
      || previous.scheduledEnd !== best.endDate
      || !sameCrewByDate(previous.crewByDate, best.crewByDate);

    if (scheduleChanged) {
      changed.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        scheduledStart: best.startDate,
        scheduledEnd: best.endDate,
      });
    }

    if (!best.covers) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'no_capacity_window',
        requiredPH: round2(candidate.requiredPH),
        assignedPH: best.assignedPH,
      });
    }

    scheduledRows.push({
      planId: candidate.planId,
      lineItemId: candidate.item.id,
      phase: candidate.phase,
      requiredPH: candidate.requiredPH,
      requestedCrew: candidate.requestedCrew,
      source: candidate.source,
      candidateDays,
      placement: best,
    });
  }

  // Local rebalance pass
  if (normalized.rebalance === 'local' && scheduledRows.length > 0) {
    const sortedRows = [...scheduledRows].sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      return a.lineItemId.localeCompare(b.lineItemId);
    });

    for (const rowState of sortedRows) {
      const current = rowState.placement;
      const baseAvailable = new Map<string, number>();
      for (const day of rowState.candidateDays) {
        const currentCrew = current.crewByDate[day.date] ?? 0;
        baseAvailable.set(day.date, day.remainingCrew + currentCrew);
      }

      const currentObjective = {
        covered: current.assignedPH,
        violations: overCapacityViolationCount(current, baseAvailable),
        spanLength: current.spanLength,
        startDate: current.startDate,
      };

      let bestPlacement = current;
      let improved = true;
      let guard = 0;

      while (improved && guard < rowState.candidateDays.length) {
        guard += 1;
        improved = false;

        for (const shift of [-1, 1] as const) {
          const nextStart = bestPlacement.startIndex + shift;
          if (nextStart < 0 || nextStart >= rowState.candidateDays.length) continue;

          const neighbor = simulatePlacement(
            rowState.candidateDays,
            nextStart,
            rowState.requiredPH,
            rowState.requestedCrew,
            normalized.allowOverAllocation,
            baseAvailable,
          );
          if (!neighbor) continue;

          const neighborObjective = {
            covered: neighbor.assignedPH,
            violations: overCapacityViolationCount(neighbor, baseAvailable),
            spanLength: neighbor.spanLength,
            startDate: neighbor.startDate,
          };

          const bestObjective = {
            covered: bestPlacement.assignedPH,
            violations: overCapacityViolationCount(bestPlacement, baseAvailable),
            spanLength: bestPlacement.spanLength,
            startDate: bestPlacement.startDate,
          };

          if (isLocalObjectiveBetter(neighborObjective, bestObjective)) {
            bestPlacement = neighbor;
            improved = true;
          }
        }
      }

      const bestObjective = {
        covered: bestPlacement.assignedPH,
        violations: overCapacityViolationCount(bestPlacement, baseAvailable),
        spanLength: bestPlacement.spanLength,
        startDate: bestPlacement.startDate,
      };

      if (!isLocalObjectiveBetter(bestObjective, currentObjective)) {
        continue;
      }

      applyPlacementToDayState(dayStateMap, current.crewByDate, -1);
      applyPlacementToDayState(dayStateMap, bestPlacement.crewByDate, 1);
      rowState.placement = bestPlacement;

      let currentPlan = planUpdatesById.get(rowState.planId)!;
      const currentItem = currentPlan.lineItems.find((x) => x.id === rowState.lineItemId);
      if (!currentItem) continue;
      const currentPf = getPhaseFields(currentItem, rowState.phase);

      const updates: Partial<PhaseFields> = {
        scheduledStart: bestPlacement.startDate,
        scheduledEnd: bestPlacement.endDate,
        crewByDate: bestPlacement.crewByDate,
      };
      if (currentPf.crew <= 0) {
        updates.crew = bestPlacement.maxCrewUsed;
      }
      if (currentPf.timeHours <= 0 && rowState.source === 'rate' && bestPlacement.maxCrewUsed > 0) {
        updates.timeHours = round2(rowState.requiredPH / bestPlacement.maxCrewUsed);
      }

      currentPlan = updatePlanLineItem(currentPlan, rowState.lineItemId, phaseFieldUpdates(rowState.phase, updates));
      planUpdatesById.set(rowState.planId, currentPlan);

      changed.push({
        planId: rowState.planId,
        lineItemId: rowState.lineItemId,
        phase: rowState.phase,
        scheduledStart: bestPlacement.startDate,
        scheduledEnd: bestPlacement.endDate,
      });
    }
  }

  // Deduplicate changed rows (rebalance may re-add same keys)
  const changedByKey = new Map<string, SharedAutoScheduleChangedRow>();
  for (const row of changed) {
    changedByKey.set(`${row.planId}:${row.lineItemId}:${row.phase}`, row);
  }
  const deduplicatedChanged = [...changedByKey.values()];

  // Compute after metrics
  const updatedPlans = plans.map((plan) => planUpdatesById.get(plan.id) ?? plan);
  const after = computeSharedMetrics(updatedPlans, calendar, defaultCrewSize, normalized.requiredWorkMode);

  return {
    planUpdatesById,
    report: {
      changed: deduplicatedChanged,
      unresolved,
      before,
      after,
    },
  };
}

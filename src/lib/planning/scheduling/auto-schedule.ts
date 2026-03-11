/**
 * Auto-schedule assistant: place line-item phase rows into work days
 * while respecting phase windows, access hours, and crew limits.
 */

import type { BuildPhase } from '../../types';
import type { Plan, PlanLineItem, PhaseFields } from '../plan-model';
import {
  getPhaseFields,
  getPhaseQuantity,
  getPhaseSpan,
  isPhaseActive,
  phaseFieldUpdates,
  updatePlanLineItem,
} from '../plan-model';
import { BUILD_PHASES } from '../../types';
import { dayAccessHours, dayCrewSize, listDateRange } from './work-calendar';
import { computeCapacitySummary } from './capacity';

export type AutoScheduleRequiredWorkMode = 'time_hours_first' | 'rate_first';
export type AutoScheduleRebalanceMode = 'none' | 'local';
export type AutoScheduleUnresolvedReason =
  | 'missing_required_hours'
  | 'no_work_days'
  | 'no_capacity_window';

export interface AutoScheduleOptions {
  requiredWorkMode?: AutoScheduleRequiredWorkMode;
  rebalance?: AutoScheduleRebalanceMode;
  includeScheduled?: boolean;
  allowOverAllocation?: boolean;
}

export interface AutoScheduleChangedRow {
  lineItemId: string;
  phase: BuildPhase;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface AutoScheduleUnresolvedRow {
  lineItemId: string;
  phase: BuildPhase;
  reason: AutoScheduleUnresolvedReason;
  requiredPH: number;
  assignedPH: number;
}

export interface AutoScheduleMetrics {
  requiredPersonHours: number;
  coveredPersonHours: number;
  coverageRatio: number;
  overCapacityDays: number;
}

export interface AutoScheduleReport {
  changed: AutoScheduleChangedRow[];
  unresolved: AutoScheduleUnresolvedRow[];
  before: AutoScheduleMetrics;
  after: AutoScheduleMetrics;
}

interface NormalizedOptions {
  requiredWorkMode: AutoScheduleRequiredWorkMode;
  rebalance: AutoScheduleRebalanceMode;
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

interface PhaseCandidateItem {
  item: PlanLineItem;
  pf: PhaseFields;
  requiredPH: number;
  requestedCrew: number;
  source: 'time' | 'rate';
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
  lineItemId: string;
  phase: BuildPhase;
  requiredPH: number;
  requestedCrew: number;
  source: 'time' | 'rate';
  candidateDays: DayState[];
  placement: Placement;
}

interface PhaseScheduleResult {
  plan: Plan;
  changed: AutoScheduleChangedRow[];
  unresolved: AutoScheduleUnresolvedRow[];
}

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
  mode: AutoScheduleRequiredWorkMode,
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

export function resolveRequiredPersonHoursForPhase(
  item: PlanLineItem,
  phase: BuildPhase,
  mode: AutoScheduleRequiredWorkMode = 'time_hours_first',
): number | null {
  return resolveRequiredWork(item, phase, mode).requiredPH;
}

function computeCoveredPersonHoursForRow(
  plan: Plan,
  item: PlanLineItem,
  phase: BuildPhase,
  requiredPH: number,
): number {
  const pf = getPhaseFields(item, phase);
  if (!pf.scheduledStart || !pf.scheduledEnd) return 0;

  const dayByDate = new Map(plan.workCalendar.map((d) => [d.date, d]));
  const dates = listDateRange(pf.scheduledStart, pf.scheduledEnd);
  let remaining = requiredPH;
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

  return round2(covered);
}

function computeScheduleMetrics(
  plan: Plan,
  mode: AutoScheduleRequiredWorkMode,
): AutoScheduleMetrics {
  let requiredPH = 0;
  let coveredPH = 0;

  for (const item of plan.lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      const required = resolveRequiredWork(item, phase, mode).requiredPH;
      if (required == null || required <= 0) continue;
      requiredPH += required;
      coveredPH += computeCoveredPersonHoursForRow(plan, item, phase, required);
    }
  }

  const capacity = computeCapacitySummary(plan);
  return {
    requiredPersonHours: round2(requiredPH),
    coveredPersonHours: round2(coveredPH),
    coverageRatio: requiredPH > 0 ? round2(coveredPH / requiredPH) : 1,
    overCapacityDays: capacity.overWorkerCapacityDayCount,
  };
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

function mapChangedRows(changed: AutoScheduleChangedRow[]): AutoScheduleChangedRow[] {
  const byKey = new Map<string, AutoScheduleChangedRow>();
  for (const row of changed) {
    byKey.set(`${row.lineItemId}:${row.phase}`, row);
  }
  return [...byKey.values()];
}

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

function schedulePhase(
  plan: Plan,
  phase: BuildPhase,
  options: NormalizedOptions,
): PhaseScheduleResult {
  const { defaultCrewSize, workCalendar } = plan;
  if (workCalendar.length === 0) return { plan, changed: [], unresolved: [] };

  const workDays = workCalendar.filter((d) => d.isWorkDay);
  if (workDays.length === 0) return { plan, changed: [], unresolved: [] };

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

  if (!options.includeScheduled) {
    for (const item of plan.lineItems) {
      if (!isPhaseActive(item, phase)) continue;
      const pf = getPhaseFields(item, phase);
      if (!pf.scheduledStart || !pf.scheduledEnd) continue;
      for (const [date, dayState] of dayStateMap) {
        if (date < pf.scheduledStart || date > pf.scheduledEnd) continue;
        const crew = pf.crewByDate?.[date] ?? pf.crew;
        dayState.remainingCrew -= crew;
      }
    }
  }

  const phaseSpan = getPhaseSpan(plan, phase);
  const candidates = phaseSpan
    ? workDays
      .filter((d) => d.date >= phaseSpan.start && d.date <= phaseSpan.end)
      .map((d) => dayStateMap.get(d.date)!)
      .filter(Boolean)
    : workDays.map((d) => dayStateMap.get(d.date)!).filter(Boolean);

  let result = plan;
  const changed: AutoScheduleChangedRow[] = [];
  const unresolved: AutoScheduleUnresolvedRow[] = [];

  const schedulable = plan.lineItems
    .filter((item) => {
      if (!isPhaseActive(item, phase)) return false;
      if (options.includeScheduled) return true;
      const pf = getPhaseFields(item, phase);
      return !pf.scheduledStart || !pf.scheduledEnd;
    })
    .map((item) => {
      const pf = getPhaseFields(item, phase);
      const required = resolveRequiredWork(item, phase, options.requiredWorkMode);
      if (required.requiredPH == null || required.requiredPH <= 0 || required.source == null) {
        unresolved.push({
          lineItemId: item.id,
          phase,
          reason: 'missing_required_hours',
          requiredPH: 0,
          assignedPH: 0,
        });
        return null;
      }
      return {
        item,
        pf,
        requiredPH: required.requiredPH,
        requestedCrew: pf.crew > 0 ? pf.crew : 1,
        source: required.source,
      } satisfies PhaseCandidateItem;
    })
    .filter((row): row is PhaseCandidateItem => row != null)
    .sort((a, b) => {
      if (b.requiredPH !== a.requiredPH) return b.requiredPH - a.requiredPH;
      return a.item.id.localeCompare(b.item.id);
    });

  if (candidates.length === 0) {
    for (const row of schedulable) {
      unresolved.push({
        lineItemId: row.item.id,
        phase,
        reason: 'no_work_days',
        requiredPH: round2(row.requiredPH),
        assignedPH: 0,
      });
    }
    return { plan: result, changed: mapChangedRows(changed), unresolved };
  }

  const scheduledRows: ScheduledRowState[] = [];

  for (const row of schedulable) {
    let best: Placement | null = null;

    for (let start = 0; start < candidates.length; start++) {
      const placement = simulatePlacement(
        candidates,
        start,
        row.requiredPH,
        row.requestedCrew,
        options.allowOverAllocation,
      );
      if (!placement) continue;
      if (!best || isPlacementBetter(placement, best)) {
        best = placement;
      }
    }

    if (!best) {
      unresolved.push({
        lineItemId: row.item.id,
        phase,
        reason: 'no_capacity_window',
        requiredPH: round2(row.requiredPH),
        assignedPH: 0,
      });
      continue;
    }

    applyPlacementToDayState(dayStateMap, best.crewByDate, 1);

    const updates: Partial<PhaseFields> = {
      scheduledStart: best.startDate,
      scheduledEnd: best.endDate,
      crewByDate: best.crewByDate,
    };
    if (row.pf.crew <= 0) {
      updates.crew = best.maxCrewUsed;
    }
    if (row.pf.timeHours <= 0 && row.source === 'rate' && best.maxCrewUsed > 0) {
      updates.timeHours = round2(row.requiredPH / best.maxCrewUsed);
    }

    result = updatePlanLineItem(result, row.item.id, phaseFieldUpdates(phase, updates));

    const previous = getPhaseFields(row.item, phase);
    const scheduleChanged =
      previous.scheduledStart !== best.startDate
      || previous.scheduledEnd !== best.endDate
      || !sameCrewByDate(previous.crewByDate, best.crewByDate);

    if (scheduleChanged) {
      changed.push({
        lineItemId: row.item.id,
        phase,
        scheduledStart: best.startDate,
        scheduledEnd: best.endDate,
      });
    }

    if (!best.covers) {
      unresolved.push({
        lineItemId: row.item.id,
        phase,
        reason: 'no_capacity_window',
        requiredPH: round2(row.requiredPH),
        assignedPH: best.assignedPH,
      });
    }

    scheduledRows.push({
      lineItemId: row.item.id,
      phase,
      requiredPH: row.requiredPH,
      requestedCrew: row.requestedCrew,
      source: row.source,
      candidateDays: candidates,
      placement: best,
    });
  }

  if (options.rebalance === 'local' && scheduledRows.length > 0) {
    const sortedRows = [...scheduledRows].sort((a, b) => a.lineItemId.localeCompare(b.lineItemId));

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
            options.allowOverAllocation,
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

      const currentItem = result.lineItems.find((x) => x.id === rowState.lineItemId);
      if (!currentItem) continue;
      const currentPf = getPhaseFields(currentItem, phase);

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

      result = updatePlanLineItem(result, rowState.lineItemId, phaseFieldUpdates(phase, updates));
      changed.push({
        lineItemId: rowState.lineItemId,
        phase,
        scheduledStart: bestPlacement.startDate,
        scheduledEnd: bestPlacement.endDate,
      });
    }
  }

  return {
    plan: result,
    changed: mapChangedRows(changed),
    unresolved,
  };
}

export function runAutoSchedule(
  plan: Plan,
  options?: AutoScheduleOptions,
): { plan: Plan; report: AutoScheduleReport } {
  const normalized = normalizeOptions(options);
  const before = computeScheduleMetrics(plan, normalized.requiredWorkMode);

  let result = plan;
  const changed: AutoScheduleChangedRow[] = [];
  const unresolved: AutoScheduleUnresolvedRow[] = [];

  for (const phase of BUILD_PHASES) {
    const phaseResult = schedulePhase(result, phase, normalized);
    result = phaseResult.plan;
    changed.push(...phaseResult.changed);
    unresolved.push(...phaseResult.unresolved);
  }

  const after = computeScheduleMetrics(result, normalized.requiredWorkMode);

  return {
    plan: result,
    report: {
      changed: mapChangedRows(changed),
      unresolved,
      before,
      after,
    },
  };
}

/**
 * Backward-compatible wrapper.
 */
export function autoSchedule(plan: Plan): Plan {
  return runAutoSchedule(plan).plan;
}

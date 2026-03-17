/**
 * Auto-schedule assistant: place line-item phase rows into work days
 * while respecting day effort capacity. Preferred crew is only a chunking hint.
 */

import type { BuildPhase } from '../../types';
import type { DailyEffortMap, Plan, PlanLineItem, PhaseFields } from '../plan-model';
import {
  getPhaseFields,
  getPhaseQuantity,
  getPhaseSpan,
  isPhaseActive,
  normalizeDailyEffortMap,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
  updatePlanLineItem,
} from '../plan-model';
import { BUILD_PHASES } from '../../types';
import { dayAccessHours, dayAvailablePersonHours } from './work-calendar';
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
  remainingPersonHours: number;
}

interface RequiredWorkResolution {
  requiredPH: number | null;
  source: 'time' | 'rate' | null;
}

interface Placement {
  assignedPH: number;
  personHoursByDate: DailyEffortMap;
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
  item: PlanLineItem,
  phase: BuildPhase,
  requiredPH: number,
): number {
  const pf = getPhaseFields(item, phase);
  const scheduled = Object.values(pf.personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0);
  return round2(Math.min(requiredPH, scheduled));
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
      coveredPH += computeCoveredPersonHoursForRow(item, phase, required);
    }
  }

  const capacity = computeCapacitySummary(plan);
  return {
    requiredPersonHours: round2(requiredPH),
    coveredPersonHours: round2(coveredPH),
    coverageRatio: requiredPH > 0 ? round2(coveredPH / requiredPH) : 1,
    overCapacityDays: capacity.overAllocatedDayCount,
  };
}

function sameEffortMap(
  a: DailyEffortMap | undefined,
  b: DailyEffortMap | undefined,
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
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
): Placement | null {
  const personHoursByDate: DailyEffortMap = {};
  let assignedPH = 0;

  for (const day of candidates) {
    if (assignedPH >= requiredPH - 0.01) break;
    const preferredDayTarget = Math.max(preferredCrew, 1) * day.accessHours;
    const availablePH = allowOverAllocation ? Math.max(day.remainingPersonHours, preferredDayTarget) : day.remainingPersonHours;
    const assignablePH = Math.min(requiredPH - assignedPH, availablePH, preferredDayTarget);
    if (assignablePH <= 0.01) continue;
    personHoursByDate[day.date] = round2(assignablePH);
    assignedPH += assignablePH;
  }

  const normalized = normalizeDailyEffortMap(personHoursByDate);
  if (!normalized) return null;
  return {
    assignedPH: round2(assignedPH),
    personHoursByDate: normalized,
  };
}

function buildDayStates(plan: Plan, options: NormalizedOptions): DayState[] {
  const availableByDate = new Map<string, number>();

  for (const day of plan.workCalendar.filter((candidate) => candidate.isWorkDay)) {
    availableByDate.set(day.date, dayAvailablePersonHours(day, plan.defaultCrewSize));
  }

  if (!options.includeScheduled) {
    for (const item of plan.lineItems) {
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;
        const pf = getPhaseFields(item, phase);
        for (const [date, hours] of Object.entries(pf.personHoursByDate ?? {})) {
          availableByDate.set(date, (availableByDate.get(date) ?? 0) - hours);
        }
      }
    }
  }

  return plan.workCalendar
    .filter((day) => day.isWorkDay)
    .map((day) => ({
      date: day.date,
      accessHours: dayAccessHours(day),
      remainingPersonHours: round2(availableByDate.get(day.date) ?? 0),
    }));
}

function schedulePhase(
  plan: Plan,
  phase: BuildPhase,
  options: NormalizedOptions,
): PhaseScheduleResult {
  if (plan.workCalendar.length === 0) return { plan, changed: [], unresolved: [] };

  const phaseSpan = getPhaseSpan(plan, phase);
  const allCandidates = buildDayStates(plan, options);
  const candidates = phaseSpan
    ? allCandidates.filter((day) => day.date >= phaseSpan.start && day.date <= phaseSpan.end)
    : allCandidates;

  if (candidates.length === 0) {
    return { plan, changed: [], unresolved: [] };
  }

  let result = plan;
  const changed: AutoScheduleChangedRow[] = [];
  const unresolved: AutoScheduleUnresolvedRow[] = [];

  const schedulable = plan.lineItems
    .filter((item) => {
      if (!isPhaseActive(item, phase)) return false;
      if (options.includeScheduled) return true;
      return Object.keys(getPhaseFields(item, phase).personHoursByDate ?? {}).length === 0;
    })
    .map((item) => {
      const pf = getPhaseFields(item, phase);
      const required = resolveRequiredWork(item, phase, options.requiredWorkMode);
      if (required.requiredPH == null || required.requiredPH <= 0) {
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
        preferredCrew: Math.max(pf.crew, 1),
      };
    })
    .filter((row): row is { item: PlanLineItem; pf: PhaseFields; requiredPH: number; preferredCrew: number } => row != null)
    .sort((a, b) => b.requiredPH - a.requiredPH || a.item.id.localeCompare(b.item.id));

  for (const row of schedulable) {
    const placement = simulatePlacement(candidates, row.requiredPH, row.preferredCrew, options.allowOverAllocation);
    if (!placement) {
      unresolved.push({
        lineItemId: row.item.id,
        phase,
        reason: 'no_capacity_window',
        requiredPH: round2(row.requiredPH),
        assignedPH: 0,
      });
      continue;
    }

    for (const [date, hours] of Object.entries(placement.personHoursByDate)) {
      const day = candidates.find((candidate) => candidate.date === date);
      if (!day) continue;
      day.remainingPersonHours = round2(day.remainingPersonHours - hours);
    }

    const span = recomputeScheduledSpanFromEffortMap(placement.personHoursByDate);
    const previous = getPhaseFields(row.item, phase);
    result = updatePlanLineItem(result, row.item.id, phaseFieldUpdates(phase, {
      scheduledStart: span.scheduledStart,
      scheduledEnd: span.scheduledEnd,
      personHoursByDate: placement.personHoursByDate,
    }));

    if (
      previous.scheduledStart !== span.scheduledStart
      || previous.scheduledEnd !== span.scheduledEnd
      || !sameEffortMap(previous.personHoursByDate, placement.personHoursByDate)
    ) {
      changed.push({
        lineItemId: row.item.id,
        phase,
        scheduledStart: span.scheduledStart,
        scheduledEnd: span.scheduledEnd,
      });
    }

    if (placement.assignedPH < row.requiredPH - 0.01) {
      unresolved.push({
        lineItemId: row.item.id,
        phase,
        reason: 'no_capacity_window',
        requiredPH: round2(row.requiredPH),
        assignedPH: placement.assignedPH,
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

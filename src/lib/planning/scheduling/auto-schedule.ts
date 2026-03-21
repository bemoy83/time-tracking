/**
 * Auto-schedule assistant: place line-item phase rows into work days
 * while respecting day effort capacity. Preferred crew is only a chunking hint.
 */

import type { BuildPhase, WorkType } from '../../types';
import type { Plan, PlanLineItem, PhaseFields } from '../plan-model';
import type { GlobalTagSequence, CrewPool } from '../../tags';
import { resolveTagSequencePosition } from '../../tags';
import {
  getPhaseFields,
  getPhaseQuantity,
  getPhaseSpan,
  isPhaseActive,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
  updatePlanLineItem,
} from '../plan-model';
import { BUILD_PHASES } from '../../types';
import { round2, sameEffortMap } from './capacity-math';
import { resolvePlanEfficiency } from '../plan-model';
import { computeCapacitySummary } from './capacity';
import { buildDayStates, simulatePlacement, type DayState, type Placement } from './placement';

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
  /**
   * When provided, line items are sorted by their earliest sequencable tag
   * position before size-based ordering. Items with no sequencable tags
   * sort after those that have tags but before items that are fully unsequenced.
   */
  tagSequence?: GlobalTagSequence;
  /**
   * System-level crew pool (tagId → headcount). When provided, the scheduler
   * enforces per-skill capacity constraints alongside the aggregate person-hours limit.
   */
  crewPool?: CrewPool;
  /**
   * Work type definitions keyed by ID. Required for skill constraint resolution.
   * When provided alongside crewPool, each line item's skillTagId is resolved
   * from its associated WorkType.
   */
  workTypes?: Map<string, WorkType>;
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
  tagSequence: GlobalTagSequence | undefined;
  crewPool: CrewPool | undefined;
  workTypes: Map<string, WorkType> | undefined;
}

interface RequiredWorkResolution {
  requiredPH: number | null;
  source: 'time' | 'rate' | null;
}

interface PhaseScheduleResult {
  plan: Plan;
  changed: AutoScheduleChangedRow[];
  unresolved: AutoScheduleUnresolvedRow[];
}

// Re-export for consumers that previously imported these from this file
export type { DayState, Placement };

const DEFAULT_OPTIONS: NormalizedOptions = {
  requiredWorkMode: 'time_hours_first',
  rebalance: 'local',
  includeScheduled: false,
  allowOverAllocation: false,
  tagSequence: undefined,
  crewPool: undefined,
  workTypes: undefined,
};

function normalizeOptions(options?: AutoScheduleOptions): NormalizedOptions {
  return {
    requiredWorkMode: options?.requiredWorkMode ?? DEFAULT_OPTIONS.requiredWorkMode,
    rebalance: options?.rebalance ?? DEFAULT_OPTIONS.rebalance,
    includeScheduled: options?.includeScheduled ?? DEFAULT_OPTIONS.includeScheduled,
    allowOverAllocation: options?.allowOverAllocation ?? DEFAULT_OPTIONS.allowOverAllocation,
    tagSequence: options?.tagSequence,
    crewPool: options?.crewPool,
    workTypes: options?.workTypes,
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

function mapChangedRows(changed: AutoScheduleChangedRow[]): AutoScheduleChangedRow[] {
  const byKey = new Map<string, AutoScheduleChangedRow>();
  for (const row of changed) {
    byKey.set(`${row.lineItemId}:${row.phase}`, row);
  }
  return [...byKey.values()];
}

function buildCommitted(plan: Plan, options: NormalizedOptions): Map<string, number> {
  const committed = new Map<string, number>();
  if (options.includeScheduled) return committed;
  for (const item of plan.lineItems) {
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      for (const [date, hours] of Object.entries(getPhaseFields(item, phase).personHoursByDate ?? {})) {
        committed.set(date, (committed.get(date) ?? 0) + hours);
      }
    }
  }
  return committed;
}

/**
 * Build per-skill committed person-hours from already-scheduled line items.
 * Returns a map of skillTagId → (date → person-hours).
 * Used to pre-reduce skillPersonHoursRemaining in buildDayStates.
 */
function buildSkillCommitted(
  plan: Plan,
  options: NormalizedOptions,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  if (options.includeScheduled || !options.workTypes) return result;
  for (const item of plan.lineItems) {
    if (!item.workTypeId) continue;
    const workType = options.workTypes.get(item.workTypeId);
    const skillTagId = workType?.skillTagId;
    if (!skillTagId) continue;
    for (const phase of BUILD_PHASES) {
      if (!isPhaseActive(item, phase)) continue;
      for (const [date, hours] of Object.entries(getPhaseFields(item, phase).personHoursByDate ?? {})) {
        let dateMap = result.get(skillTagId);
        if (!dateMap) { dateMap = new Map(); result.set(skillTagId, dateMap); }
        dateMap.set(date, (dateMap.get(date) ?? 0) + hours);
      }
    }
  }
  return result;
}

function schedulePhase(
  plan: Plan,
  phase: BuildPhase,
  options: NormalizedOptions,
): PhaseScheduleResult {
  if (plan.workCalendar.length === 0) return { plan, changed: [], unresolved: [] };

  const phaseSpan = getPhaseSpan(plan, phase);
  const efficiency = resolvePlanEfficiency(plan);
  const crewPoolAllocations = options.crewPool?.allocations;
  const effectiveDefaultCrew = options.crewPool?.defaultCrewSize ?? plan.defaultCrewSize;
  const allCandidates = buildDayStates(
    plan.workCalendar,
    effectiveDefaultCrew,
    efficiency,
    buildCommitted(plan, options),
    crewPoolAllocations,
    options.workTypes ? buildSkillCommitted(plan, options) : undefined,
  );
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
      const workType = item.workTypeId ? options.workTypes?.get(item.workTypeId) : undefined;
      const skillTagId = workType?.skillTagId ?? undefined;
      const skillCrew = skillTagId ? options.crewPool?.allocations[skillTagId] : undefined;
      const effectiveDefaultCrew = options.crewPool?.defaultCrewSize ?? plan.defaultCrewSize ?? 1;
      return {
        item,
        pf,
        requiredPH: required.requiredPH,
        preferredCrew: skillCrew != null
          ? Math.max(skillCrew, 1)
          : Math.max(pf.crew, effectiveDefaultCrew, 1),
        skillTagId: skillTagId ?? undefined,
      };
    })
    .filter((row): row is { item: PlanLineItem; pf: PhaseFields; requiredPH: number; preferredCrew: number; skillTagId: string | undefined } => row != null)
    .sort((a, b) => {
      if (options.tagSequence) {
        const seqIds = options.tagSequence.tagIds;
        const posA = resolveTagSequencePosition(a.item.tagIds ?? [], seqIds);
        const posB = resolveTagSequencePosition(b.item.tagIds ?? [], seqIds);
        if (posA !== posB) return posA - posB;
      }
      return b.requiredPH - a.requiredPH || a.item.id.localeCompare(b.item.id);
    });

  for (const row of schedulable) {
    const placement = simulatePlacement(candidates, row.requiredPH, row.preferredCrew, options.allowOverAllocation, row.skillTagId);
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

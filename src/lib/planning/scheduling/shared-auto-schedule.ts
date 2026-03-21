/**
 * Shared schedule assistant: place unscheduled phase rows across multiple plans
 * against a shared crew-pool calendar using daily effort capacity.
 */

import type { BuildPhase, WorkType } from '../../types';
import { BUILD_PHASES } from '../../types';
import type { Plan, WorkCalendarDay } from '../plan-model';
import {
  getPhaseFields,
  getPhaseSpan,
  isPhaseActive,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
  updatePlanLineItem,
  DEFAULT_PLAN_EFFICIENCY,
} from '../plan-model';
import { round2, sameEffortMap } from './capacity-math';
import { computeSharedCapacitySummary } from './capacity';
import { buildDayStates, simulatePlacement } from './placement';
import type {
  AutoScheduleOptions,
  AutoScheduleMetrics,
  AutoScheduleUnresolvedReason,
} from './auto-schedule';
import { resolveRequiredPersonHoursForPhase } from './auto-schedule';
import type { GlobalTagSequence, CrewPool } from '../../tags';
import { resolveTagSequencePosition } from '../../tags';

export interface SharedAutoScheduleInput {
  plans: Plan[];
  calendar: WorkCalendarDay[];
  defaultCrewSize: number;
  /**
   * When provided, line items across all plans are sorted by their earliest
   * sequencable tag position before size-based ordering.
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

interface NormalizedOptions {
  includeScheduled: boolean;
  allowOverAllocation: boolean;
}

const DEFAULT_OPTIONS: NormalizedOptions = {
  includeScheduled: false,
  allowOverAllocation: false,
};

function normalizeOptions(options?: AutoScheduleOptions): NormalizedOptions {
  return {
    includeScheduled: options?.includeScheduled ?? DEFAULT_OPTIONS.includeScheduled,
    allowOverAllocation: options?.allowOverAllocation ?? DEFAULT_OPTIONS.allowOverAllocation,
  };
}

function computeSharedMetrics(input: SharedAutoScheduleInput, plans: Plan[]): AutoScheduleMetrics {
  let requiredPH = 0;
  let coveredPH = 0;
  for (const plan of plans) {
    for (const item of plan.lineItems) {
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;
        const required = resolveRequiredPersonHoursForPhase(item, phase);
        if (required == null || required <= 0) continue;
        requiredPH += required;
        coveredPH += Math.min(
          required,
          Object.values(getPhaseFields(item, phase).personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0),
        );
      }
    }
  }

  const capacity = computeSharedCapacitySummary({
    calendar: input.calendar,
    defaultCrewSize: input.defaultCrewSize,
    lineItems: plans.flatMap((plan) => plan.lineItems.map((item) => ({
      planId: plan.id,
      lineItemId: item.id,
      plan,
      item,
      readOnly: false,
    }))),
  });

  return {
    requiredPersonHours: round2(requiredPH),
    coveredPersonHours: round2(coveredPH),
    coverageRatio: requiredPH > 0 ? round2(coveredPH / requiredPH) : 1,
    overCapacityDays: capacity.overAllocatedDayCount,
  };
}

function buildCommitted(plans: Plan[], options: NormalizedOptions): Map<string, number> {
  const committed = new Map<string, number>();
  if (options.includeScheduled) return committed;
  for (const plan of plans) {
    for (const item of plan.lineItems) {
      for (const phase of BUILD_PHASES) {
        if (!isPhaseActive(item, phase)) continue;
        for (const [date, hours] of Object.entries(getPhaseFields(item, phase).personHoursByDate ?? {})) {
          committed.set(date, (committed.get(date) ?? 0) + hours);
        }
      }
    }
  }
  return committed;
}

/**
 * Build per-skill committed person-hours from already-scheduled line items across all plans.
 * Returns a map of skillTagId → (date → person-hours).
 */
function buildSkillCommitted(
  plans: Plan[],
  workTypes: Map<string, WorkType>,
  options: NormalizedOptions,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  if (options.includeScheduled) return result;
  for (const plan of plans) {
    for (const item of plan.lineItems) {
      if (!item.workTypeId) continue;
      const skillTagId = workTypes.get(item.workTypeId)?.skillTagId;
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
  }
  return result;
}

export function runSharedAutoSchedule(
  input: SharedAutoScheduleInput,
  options?: AutoScheduleOptions,
): SharedAutoScheduleResult {
  const normalized = normalizeOptions(options);
  const before = computeSharedMetrics(input, input.plans);
  const plansById = new Map(input.plans.map((plan) => [plan.id, plan]));
  const changed: SharedAutoScheduleChangedRow[] = [];
  const unresolved: SharedAutoScheduleUnresolvedRow[] = [];

  // Shared schedule always uses the fixed DEFAULT_PLAN_EFFICIENCY — no per-plan override.
  const crewPoolAllocations = input.crewPool?.allocations;
  const effectiveDefaultCrew = input.crewPool?.defaultCrewSize ?? input.defaultCrewSize;
  const dayStates = buildDayStates(
    input.calendar,
    effectiveDefaultCrew,
    DEFAULT_PLAN_EFFICIENCY,
    buildCommitted(input.plans, normalized),
    crewPoolAllocations,
    input.workTypes ? buildSkillCommitted(input.plans, input.workTypes, normalized) : undefined,
  );

  const candidates = input.plans
    .flatMap((plan) => plan.lineItems.map((item) => ({ plan, item })))
    .flatMap(({ plan, item }) => BUILD_PHASES.map((phase) => ({ plan, item, phase })))
    .filter(({ item, phase }) => isPhaseActive(item, phase))
    .filter(({ item, phase }) => normalized.includeScheduled || Object.keys(getPhaseFields(item, phase).personHoursByDate ?? {}).length === 0)
    .map(({ plan, item, phase }) => {
      const workType = item.workTypeId ? input.workTypes?.get(item.workTypeId) : undefined;
      const skillTagId = workType?.skillTagId ?? undefined;
      const skillCrew = skillTagId ? input.crewPool?.allocations[skillTagId] : undefined;
      const pf = getPhaseFields(item, phase);
      return {
        planId: plan.id,
        item,
        phase,
        pf,
        requiredPH: resolveRequiredPersonHoursForPhase(item, phase),
        span: getPhaseSpan(plan, phase),
        skillTagId: skillTagId ?? undefined,
        preferredCrew: skillCrew != null
          ? Math.max(skillCrew, 1)
          : Math.max(pf.crew, input.crewPool?.defaultCrewSize ?? input.defaultCrewSize, 1),
      };
    })
    .sort((a, b) => {
      if (input.tagSequence) {
        const seqIds = input.tagSequence.tagIds;
        const posA = resolveTagSequencePosition(a.item.tagIds ?? [], seqIds);
        const posB = resolveTagSequencePosition(b.item.tagIds ?? [], seqIds);
        if (posA !== posB) {
          // Dismantle is LIFO: last assembled → first dismantled.
          // When both items are in the same phase, apply phase-specific ordering.
          // Cross-phase items are separated by date windows so direction doesn't matter.
          if (a.phase === b.phase) {
            return a.phase === 'dismantle' ? posB - posA : posA - posB;
          }
          return posA - posB;
        }
      }
      return (b.requiredPH ?? 0) - (a.requiredPH ?? 0) || a.item.id.localeCompare(b.item.id);
    });

  for (const candidate of candidates) {
    if (candidate.requiredPH == null || candidate.requiredPH <= 0) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'missing_required_hours',
        requiredPH: 0,
        assignedPH: 0,
      });
      continue;
    }

    const scopedDays = candidate.span
      ? dayStates.filter((day) => day.date >= candidate.span!.start && day.date <= candidate.span!.end)
      : dayStates;
    if (scopedDays.length === 0) {
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

    const placement = simulatePlacement(
      scopedDays,
      candidate.requiredPH,
      candidate.preferredCrew,
      normalized.allowOverAllocation,
      candidate.skillTagId,
    );
    if (!placement) {
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

    for (const [date, hours] of Object.entries(placement.personHoursByDate)) {
      const day = dayStates.find((entry) => entry.date === date);
      if (!day) continue;
      day.remainingPersonHours = round2(day.remainingPersonHours - hours);
    }

    const plan = plansById.get(candidate.planId);
    if (!plan) continue;
    const span = recomputeScheduledSpanFromEffortMap(placement.personHoursByDate);
    const updatedPlan = updatePlanLineItem(plan, candidate.item.id, phaseFieldUpdates(candidate.phase, {
      scheduledStart: span.scheduledStart,
      scheduledEnd: span.scheduledEnd,
      personHoursByDate: placement.personHoursByDate,
    }));
    plansById.set(candidate.planId, updatedPlan);

    if (
      candidate.pf.scheduledStart !== span.scheduledStart
      || candidate.pf.scheduledEnd !== span.scheduledEnd
      || !sameEffortMap(candidate.pf.personHoursByDate, placement.personHoursByDate)
    ) {
      changed.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        scheduledStart: span.scheduledStart,
        scheduledEnd: span.scheduledEnd,
      });
    }

    if (placement.assignedPH < candidate.requiredPH - 0.01) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'no_capacity_window',
        requiredPH: round2(candidate.requiredPH),
        assignedPH: placement.assignedPH,
      });
    }
  }

  const updatedPlans = input.plans.map((plan) => plansById.get(plan.id) ?? plan);
  const after = computeSharedMetrics(input, updatedPlans);

  return {
    planUpdatesById: plansById,
    report: {
      changed,
      unresolved,
      before,
      after,
    },
  };
}

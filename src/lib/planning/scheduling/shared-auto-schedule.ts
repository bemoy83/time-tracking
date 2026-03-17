/**
 * Shared schedule assistant: place unscheduled phase rows across multiple plans
 * against a shared crew-pool calendar using daily effort capacity.
 */

import type { BuildPhase } from '../../types';
import { BUILD_PHASES } from '../../types';
import type { DailyEffortMap, Plan, WorkCalendarDay } from '../plan-model';
import {
  getPhaseFields,
  getPhaseSpan,
  isPhaseActive,
  normalizeDailyEffortMap,
  phaseFieldUpdates,
  recomputeScheduledSpanFromEffortMap,
  updatePlanLineItem,
} from '../plan-model';
import { dayAccessHours, dayAvailablePersonHours } from './work-calendar';
import { computeSharedCapacitySummary } from './capacity';
import type {
  AutoScheduleOptions,
  AutoScheduleMetrics,
  AutoScheduleUnresolvedReason,
} from './auto-schedule';
import { resolveRequiredPersonHoursForPhase } from './auto-schedule';

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

interface NormalizedOptions {
  includeScheduled: boolean;
  allowOverAllocation: boolean;
}

interface DayState {
  date: string;
  accessHours: number;
  remainingPersonHours: number;
}

const DEFAULT_OPTIONS: NormalizedOptions = {
  includeScheduled: false,
  allowOverAllocation: false,
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

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

function buildDayStates(input: SharedAutoScheduleInput, plans: Plan[], options: NormalizedOptions): DayState[] {
  const remainingByDate = new Map<string, number>();
  for (const day of input.calendar.filter((candidate) => candidate.isWorkDay)) {
    remainingByDate.set(day.date, dayAvailablePersonHours(day, input.defaultCrewSize));
  }

  if (!options.includeScheduled) {
    for (const plan of plans) {
      for (const item of plan.lineItems) {
        for (const phase of BUILD_PHASES) {
          if (!isPhaseActive(item, phase)) continue;
          const pf = getPhaseFields(item, phase);
          for (const [date, hours] of Object.entries(pf.personHoursByDate ?? {})) {
            remainingByDate.set(date, (remainingByDate.get(date) ?? 0) - hours);
          }
        }
      }
    }
  }

  return input.calendar
    .filter((day) => day.isWorkDay)
    .map((day) => ({
      date: day.date,
      accessHours: dayAccessHours(day),
      remainingPersonHours: round2(remainingByDate.get(day.date) ?? 0),
    }));
}

function simulatePlacement(
  candidates: DayState[],
  requiredPH: number,
  preferredCrew: number,
  allowOverAllocation: boolean,
): DailyEffortMap | undefined {
  const result: DailyEffortMap = {};
  let assignedPH = 0;

  for (const day of candidates) {
    if (assignedPH >= requiredPH - 0.01) break;
    const preferredDayTarget = Math.max(preferredCrew, 1) * day.accessHours;
    const availablePH = allowOverAllocation ? Math.max(day.remainingPersonHours, preferredDayTarget) : day.remainingPersonHours;
    const assignablePH = Math.min(requiredPH - assignedPH, availablePH, preferredDayTarget);
    if (assignablePH <= 0.01) continue;
    result[day.date] = round2(assignablePH);
    assignedPH += assignablePH;
  }

  return normalizeDailyEffortMap(result);
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
  const dayStates = buildDayStates(input, input.plans, normalized);

  const candidates = input.plans
    .flatMap((plan) => plan.lineItems.map((item) => ({ plan, item })))
    .flatMap(({ plan, item }) => BUILD_PHASES.map((phase) => ({ plan, item, phase })))
    .filter(({ item, phase }) => isPhaseActive(item, phase))
    .filter(({ item, phase }) => normalized.includeScheduled || Object.keys(getPhaseFields(item, phase).personHoursByDate ?? {}).length === 0)
    .map(({ plan, item, phase }) => ({
      planId: plan.id,
      item,
      phase,
      pf: getPhaseFields(item, phase),
      requiredPH: resolveRequiredPersonHoursForPhase(item, phase),
      span: getPhaseSpan(plan, phase),
    }))
    .sort((a, b) => (b.requiredPH ?? 0) - (a.requiredPH ?? 0) || a.item.id.localeCompare(b.item.id));

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

    const placement = simulatePlacement(scopedDays, candidate.requiredPH, candidate.pf.crew, normalized.allowOverAllocation);
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

    for (const [date, hours] of Object.entries(placement)) {
      const day = dayStates.find((entry) => entry.date === date);
      if (!day) continue;
      day.remainingPersonHours = round2(day.remainingPersonHours - hours);
    }

    const plan = plansById.get(candidate.planId);
    if (!plan) continue;
    const span = recomputeScheduledSpanFromEffortMap(placement);
    const updatedPlan = updatePlanLineItem(plan, candidate.item.id, phaseFieldUpdates(candidate.phase, {
      scheduledStart: span.scheduledStart,
      scheduledEnd: span.scheduledEnd,
      personHoursByDate: placement,
    }));
    plansById.set(candidate.planId, updatedPlan);

    if (
      candidate.pf.scheduledStart !== span.scheduledStart
      || candidate.pf.scheduledEnd !== span.scheduledEnd
      || !sameEffortMap(candidate.pf.personHoursByDate, placement)
    ) {
      changed.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        scheduledStart: span.scheduledStart,
        scheduledEnd: span.scheduledEnd,
      });
    }

    const assignedPH = Object.values(placement).reduce((sum, value) => sum + value, 0);
    if (assignedPH < candidate.requiredPH - 0.01) {
      unresolved.push({
        planId: candidate.planId,
        lineItemId: candidate.item.id,
        phase: candidate.phase,
        reason: 'no_capacity_window',
        requiredPH: round2(candidate.requiredPH),
        assignedPH: round2(assignedPH),
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

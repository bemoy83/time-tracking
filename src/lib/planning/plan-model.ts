/**
 * Planning workspace data model.
 *
 * A Plan is a collection of work packages (line items) with editable
 * assumptions. Plans can be in planner states ('draft' | 'active' | 'reviewed')
 * or executor states ('received' | 'session-closed').
 *
 * Each line item is phase-agnostic: it carries per-phase assumptions (rate,
 * crew, time) for both assembly and dismantle. A phase with rate=0 and
 * crew=0 and timeHours=0 is considered inactive.
 */

import type { WorkUnit, BuildPhase, Project } from '../types';
import { generateId, nowUtc } from '../types';
import type { WorkTypeKey } from '../kpi';
import { lineItemWorkTypeKey as toLineItemWorkTypeKey } from '../work-package-core';
import {
  type DateSpan,
  getPhaseSpan as getPhaseSpanInternal,
  getPlanEffectiveSpan as getPlanEffectiveSpanInternal,
  hasPhaseDates as hasPhaseDatesInternal,
} from './scheduling/schedule-span';

export type PlanStatus =
  | 'draft'
  | 'active'
  | 'reviewed'
  | 'received'
  | 'session-closed';

export type LineItemExecutionStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'blocked'
  | 'deferred';

export type BlockCategory =
  | 'access'
  | 'materials'
  | 'crew'
  | 'dependency'
  | 'other';

export type RateSource = 'template' | 'historical' | 'manual';
export type DailyEffortMap = Record<string, number>;

export interface WorkCalendarDay {
  /** Local calendar date (YYYY-MM-DD). */
  date: string;
  /** Workable day toggle (false = off day). */
  isWorkDay: boolean;
  /** Local access start time (HH:mm) for work day. */
  accessStart: string | null;
  /** Local access end time (HH:mm) for work day. */
  accessEnd: string | null;
  /** Per-day crew override; null falls back to plan default crew size. */
  crewSize: number | null;
  /** Per-day efficiency override (0.5–1.0); null (or absent) falls back to plan defaultEfficiency. */
  efficiency?: number | null;
}

export interface PlanLineItem {
  // Identity (shared)
  id: string;
  /** Display name for the work package. */
  title: string;
  /** Work type fields — used for KPI lookup. */
  workTypeTitle: string;
  workUnit: WorkUnit;
  /** Reference to WorkType entity. null for legacy line items. */
  workTypeId: string | null;
  /** Shared work quantity (default for both phases). */
  workQuantity: number;
  /** Override quantity for dismantle when unlinked from assembly. */
  dismantleQuantity?: number | null;

  // Assembly assumptions
  /** Productivity rate for assembly (units/person-hr). 0 = phase not applicable. */
  assemblyRate: number;
  assemblyCrew: number;
  assemblyTimeHours: number;
  assemblyRateSource: RateSource;

  // Dismantle assumptions
  /** Productivity rate for dismantle (units/person-hr). 0 = phase not applicable. */
  dismantleRate: number;
  dismantleCrew: number;
  dismantleTimeHours: number;
  dismantleRateSource: RateSource;

  // Assembly scheduling (independent per phase)
  assemblyScheduledStart: string | null;
  assemblyScheduledEnd: string | null;
  assemblyOriginalScheduledStart: string | null;
  assemblyOriginalScheduledEnd: string | null;
  assemblyPersonHoursByDate?: DailyEffortMap;

  // Dismantle scheduling (independent per phase)
  dismantleScheduledStart: string | null;
  dismantleScheduledEnd: string | null;
  dismantleOriginalScheduledStart: string | null;
  dismantleOriginalScheduledEnd: string | null;
  dismantlePersonHoursByDate?: DailyEffortMap;

  // Assembly execution state
  assemblyExecutionStatus: LineItemExecutionStatus;
  assemblyBlockReason: string | null;
  assemblyBlockCategory: BlockCategory | null;
  assemblyExecutorNote: string | null;
  assemblyDeferredNote: string | null;

  // Dismantle execution state
  dismantleExecutionStatus: LineItemExecutionStatus;
  dismantleBlockReason: string | null;
  dismantleBlockCategory: BlockCategory | null;
  dismantleExecutorNote: string | null;
  dismantleDeferredNote: string | null;

  // Shared
  /** Optional rationale note for this line item. */
  rationale: string | null;
  /** Optional post-execution review note for this line item. */
  reviewNote?: string | null;
  /**
   * True when the source line item was removed in an upstream re-import merge.
   * Kept visible as historical context on executor device.
   */
  removedFromSource: boolean;
  /** Optional planner amendment rationale for schedule change. */
  amendmentNote: string | null;
  /** Timestamp when schedule was amended after baseline. */
  amendedAt: string | null;
  /**
   * Tag IDs snapshotted from the WorkType at line item creation time.
   * Self-contained so plan packages carry tag context to field devices.
   * Editable in the planner before the plan is released.
   */
  tagIds?: string[];
}

// ---------------------------------------------------------------------------
// Phase field accessor
// ---------------------------------------------------------------------------

export interface PhaseFields {
  rate: number;
  crew: number;
  timeHours: number;
  rateSource: RateSource;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  originalScheduledStart: string | null;
  originalScheduledEnd: string | null;
  personHoursByDate: DailyEffortMap | undefined;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
}

const PHASE_CONFIG = {
  assembly: {
    prefix: 'assembly',
    quantityOverrideField: null,
  },
  dismantle: {
    prefix: 'dismantle',
    quantityOverrideField: 'dismantleQuantity',
  },
} as const satisfies Record<
  BuildPhase,
  {
    prefix: 'assembly' | 'dismantle';
    quantityOverrideField: 'dismantleQuantity' | null;
  }
>;

const PHASE_FIELD_SUFFIXES = {
  rate: 'Rate',
  crew: 'Crew',
  timeHours: 'TimeHours',
  rateSource: 'RateSource',
  scheduledStart: 'ScheduledStart',
  scheduledEnd: 'ScheduledEnd',
  originalScheduledStart: 'OriginalScheduledStart',
  originalScheduledEnd: 'OriginalScheduledEnd',
  personHoursByDate: 'PersonHoursByDate',
  executionStatus: 'ExecutionStatus',
  blockReason: 'BlockReason',
  blockCategory: 'BlockCategory',
  executorNote: 'ExecutorNote',
  deferredNote: 'DeferredNote',
} as const satisfies Record<keyof PhaseFields, string>;

const PHASE_FIELD_NAMES = Object.keys(PHASE_FIELD_SUFFIXES) as Array<keyof PhaseFields>;
type PhasePrefix = (typeof PHASE_CONFIG)[BuildPhase]['prefix'];
type PhaseSpecificPlanLineItemField =
  `${PhasePrefix}${(typeof PHASE_FIELD_SUFFIXES)[keyof typeof PHASE_FIELD_SUFFIXES]}`;

function getPhaseFieldKey<FieldName extends keyof PhaseFields>(
  phase: BuildPhase,
  fieldName: FieldName,
): PhaseSpecificPlanLineItemField {
  const { prefix } = PHASE_CONFIG[phase];
  const suffix = PHASE_FIELD_SUFFIXES[fieldName];
  return `${prefix}${suffix}` as PhaseSpecificPlanLineItemField;
}

function readPhaseField<FieldName extends keyof PhaseFields>(
  item: PlanLineItem,
  phase: BuildPhase,
  fieldName: FieldName,
): PhaseFields[FieldName] {
  return item[getPhaseFieldKey(phase, fieldName)] as PhaseFields[FieldName];
}

function phaseFieldState(
  phase: BuildPhase,
  fields: PhaseFields,
): Pick<PlanLineItem, PhaseSpecificPlanLineItemField> {
  const result: Record<string, unknown> = {};
  for (const fieldName of PHASE_FIELD_NAMES) {
    result[getPhaseFieldKey(phase, fieldName)] = fields[fieldName];
  }
  return result as Pick<PlanLineItem, PhaseSpecificPlanLineItemField>;
}

/** Read all per-phase fields for the given phase. */
export function getPhaseFields(item: PlanLineItem, phase: BuildPhase): PhaseFields {
  return Object.fromEntries(
    PHASE_FIELD_NAMES.map((fieldName) => [fieldName, readPhaseField(item, phase, fieldName)]),
  ) as unknown as PhaseFields;
}

/** True when a phase has any non-zero rate, crew, or time. */
export function isPhaseActive(item: PlanLineItem, phase: BuildPhase): boolean {
  const { rate, crew, timeHours } = getPhaseFields(item, phase);
  return rate > 0 || crew > 0 || timeHours > 0;
}

/** Return the effective quantity for a given phase (dismantle may override). */
export function getPhaseQuantity(item: PlanLineItem, phase: BuildPhase): number {
  const quantityOverrideField = PHASE_CONFIG[phase].quantityOverrideField;
  if (quantityOverrideField) {
    const quantityOverride = item[quantityOverrideField];
    if (quantityOverride != null) {
      return quantityOverride;
    }
  }
  return item.workQuantity;
}

/** Build the prefixed update object for a single phase's fields. */
export function phaseFieldUpdates(
  phase: BuildPhase,
  updates: Partial<PhaseFields>,
): Partial<PlanLineItem> {
  const result: Record<string, unknown> = {};
  for (const fieldName of PHASE_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(updates, fieldName)) {
      result[getPhaseFieldKey(phase, fieldName)] = updates[fieldName];
    }
  }
  return result as Partial<PlanLineItem>;
}

// ---------------------------------------------------------------------------
// Plan type & date helpers
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  lineItems: PlanLineItem[];
  /** Event/project this plan belongs to. null = unassigned. */
  projectId: string | null;
  /** Event start date (YYYY-MM-DD). */
  eventStartDate: string | null;
  /** Event end date (YYYY-MM-DD). */
  eventEndDate: string | null;
  /** Assembly start date (YYYY-MM-DD). */
  assemblyStartDate: string | null;
  /** Assembly end date (YYYY-MM-DD). */
  assemblyEndDate: string | null;
  /** Dismantle start date (YYYY-MM-DD). */
  dismantleStartDate: string | null;
  /** Dismantle end date (YYYY-MM-DD). */
  dismantleEndDate: string | null;
  /** Default crew size for schedule capacity math. */
  defaultCrewSize: number | null;
  /** Efficiency factor (0.5–1.0). null = use app default (0.8). */
  defaultEfficiency: number | null;
  /** Per-day work calendar across event period. */
  workCalendar: WorkCalendarDay[];
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when plan was activated. null if draft. */
  activatedAt: string | null;
  /** ISO timestamp when plan was handed off to field/floor manager. */
  handedOffAt?: string | null;
  /** ISO timestamp when plan wrap-up review was finalized. */
  reviewedAt?: string | null;
  /** ISO timestamp when plan was imported onto executor device. */
  importedAt?: string | null;
  /** ISO timestamp when executor closed the session. */
  sessionClosedAt?: string | null;
}

export type PlanDateSpan = DateSpan;

export function hasPhaseDates(
  plan: Pick<Plan, 'assemblyStartDate' | 'assemblyEndDate' | 'dismantleStartDate' | 'dismantleEndDate'>,
): plan is Pick<Plan, 'assemblyStartDate' | 'assemblyEndDate' | 'dismantleStartDate' | 'dismantleEndDate'> & {
  assemblyStartDate: string;
  assemblyEndDate: string;
  dismantleStartDate: string;
  dismantleEndDate: string;
} {
  return hasPhaseDatesInternal(plan);
}

export function getPlanEffectiveSpan(
  plan: Pick<
    Plan,
    | 'eventStartDate'
    | 'eventEndDate'
    | 'assemblyStartDate'
    | 'assemblyEndDate'
    | 'dismantleStartDate'
    | 'dismantleEndDate'
  >,
): PlanDateSpan | null {
  return getPlanEffectiveSpanInternal(plan);
}

export function getPhaseSpan(
  plan: Pick<Plan, 'assemblyStartDate' | 'assemblyEndDate' | 'dismantleStartDate' | 'dismantleEndDate'>,
  phase: BuildPhase,
): PlanDateSpan | null {
  return getPhaseSpanInternal(plan, phase);
}

export function getPlanDisplayName(
  plan: Pick<Plan, 'title'>,
  project?: Pick<Project, 'name'> | null,
): string {
  return project?.name ?? plan.title;
}

// ---------------------------------------------------------------------------
// Resolve helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a canonical WorkType title for line-item keying.
 * Falls back to line-item title for legacy plans missing explicit WorkType title.
 */
export function resolveLineItemWorkTypeTitle(
  item: Pick<PlanLineItem, 'workTypeTitle' | 'title'>,
): string {
  if (item.workTypeTitle && item.workTypeTitle.trim().length > 0) {
    return item.workTypeTitle;
  }
  return item.title;
}

/** Get the WorkTypeKey for a line item (for KPI lookups). */
export function lineItemWorkTypeKey(item: PlanLineItem): WorkTypeKey {
  return toLineItemWorkTypeKey(item);
}

// ---------------------------------------------------------------------------
// Effort / schedule helpers (phase-aware)
// ---------------------------------------------------------------------------

function roundPlannedPersonHours(value: number): number {
  return Number(value.toFixed(2));
}

export function normalizeDailyEffortMap(
  value: DailyEffortMap | undefined,
): DailyEffortMap | undefined {
  if (!value) return undefined;
  const normalized: DailyEffortMap = {};
  for (const [date, hours] of Object.entries(value)) {
    if (!Number.isFinite(hours) || hours <= 0) continue;
    normalized[date] = roundPlannedPersonHours(hours);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function getAssignedDatesFromEffortMap(
  personHoursByDate: DailyEffortMap | undefined,
): string[] {
  return Object.keys(personHoursByDate ?? {})
    .filter((date) => (personHoursByDate?.[date] ?? 0) > 0)
    .sort();
}

export function recomputeScheduledSpanFromEffortMap(
  personHoursByDate: DailyEffortMap | undefined,
): { scheduledStart: string | null; scheduledEnd: string | null } {
  const dates = getAssignedDatesFromEffortMap(personHoursByDate);
  if (dates.length === 0) {
    return { scheduledStart: null, scheduledEnd: null };
  }
  return {
    scheduledStart: dates[0],
    scheduledEnd: dates[dates.length - 1],
  };
}

export function getPlannedPersonHoursForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
): number {
  const pf = getPhaseFields(item, phase);
  return roundPlannedPersonHours(pf.personHoursByDate?.[date] ?? 0);
}

/**
 * Legacy crew-equivalent helper retained for display-oriented callers.
 * Returns preferred crew for task/release semantics, not assignment truth.
 */
export function getEffectiveCrewForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
): number {
  const pf = getPhaseFields(item, phase);
  return getPlannedPersonHoursForDate(item, phase, date) > 0 ? pf.crew : 0;
}

/**
 * Effective single crew value for a line item phase (for task creation, etc.).
 * Returns preferred crew only; schedule truth lives in personHoursByDate.
 */
export function lineItemEffectiveCrew(item: PlanLineItem, phase: BuildPhase): number {
  return getPhaseFields(item, phase).crew;
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

/** Compute total person-hours for a plan (summing both phases). */
export function planTotalPersonHours(plan: Plan): number {
  return plan.lineItems.reduce((sum, item) => {
    const bu = item.assemblyTimeHours * item.assemblyCrew;
    const td = item.dismantleTimeHours * item.dismantleCrew;
    return sum + bu + td;
  }, 0);
}

/** Compute total person-hours for a plan for a single phase. */
export function planPhasePersonHours(plan: Plan, phase: BuildPhase): number {
  return plan.lineItems.reduce((sum, item) => {
    const pf = getPhaseFields(item, phase);
    return sum + pf.timeHours * pf.crew;
  }, 0);
}

/** Compute total work quantity for a plan (grouped by unit). */
export function planTotalsByUnit(plan: Plan): Map<WorkUnit, number> {
  const totals = new Map<WorkUnit, number>();
  for (const item of plan.lineItems) {
    totals.set(item.workUnit, (totals.get(item.workUnit) ?? 0) + item.workQuantity);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Efficiency helpers
// ---------------------------------------------------------------------------

export const DEFAULT_PLAN_EFFICIENCY = 0.8;

/** Clamp a raw number to the valid efficiency range [0.5, 1.0]. Returns null for invalid input. */
export function normalizePlanEfficiency(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(1.0, Math.max(0.5, value));
}

/** Resolve the efficiency to use for capacity math. Never returns null. */
export function resolvePlanEfficiency(plan: Pick<Plan, 'defaultEfficiency'>): number {
  return normalizePlanEfficiency(plan.defaultEfficiency) ?? DEFAULT_PLAN_EFFICIENCY;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** Create a new empty draft plan. */
export function createPlan(title: string): Plan {
  const now = nowUtc();
  return {
    id: generateId(),
    title,
    status: 'draft',
    lineItems: [],
    projectId: null,
    eventStartDate: null,
    eventEndDate: null,
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    defaultCrewSize: null,
    defaultEfficiency: null,
    workCalendar: [],
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
  };
}

/** Create a new line item with per-phase defaults. */
export function createLineItem(
  title: string,
  workTypeTitle: string,
  workUnit: WorkUnit,
  workQuantity: number,
  assemblyRate: number,
  dismantleRate: number,
  rateSource: RateSource = 'manual',
  workTypeId: string | null = null,
  tagIds: string[] = [],
): PlanLineItem {
  const assemblyTimeHours = assemblyRate > 0 ? workQuantity / assemblyRate : 0;
  const dismantleTimeHours = dismantleRate > 0 ? workQuantity / dismantleRate : 0;
  return {
    id: generateId(),
    title,
    workTypeTitle,
    workUnit,
    workTypeId,
    workQuantity,
    dismantleQuantity: null,
    ...phaseFieldState('assembly', {
      rate: assemblyRate,
      crew: assemblyRate > 0 ? 1 : 0,
      timeHours: assemblyTimeHours,
      rateSource,
      scheduledStart: null,
      scheduledEnd: null,
      originalScheduledStart: null,
      originalScheduledEnd: null,
      personHoursByDate: undefined,
      executionStatus: 'pending',
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    ...phaseFieldState('dismantle', {
      rate: dismantleRate,
      crew: dismantleRate > 0 ? 1 : 0,
      timeHours: dismantleTimeHours,
      rateSource,
      scheduledStart: null,
      scheduledEnd: null,
      originalScheduledStart: null,
      originalScheduledEnd: null,
      personHoursByDate: undefined,
      executionStatus: 'pending',
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),

    rationale: null,
    reviewNote: null,
    removedFromSource: false,
    amendmentNote: null,
    amendedAt: null,
    tagIds,
  };
}

/** Duplicate a line item, preserving work-type fields and per-phase assumptions. */
export function duplicateLineItem(item: PlanLineItem): PlanLineItem {
  const trimmedTitle = item.title.trim();
  const baseTitle = trimmedTitle.replace(/\s*\(copy\)\s*$/i, '').trim();
  const duplicateTitle = `${baseTitle || trimmedTitle} (copy)`.trim();

  return {
    id: generateId(),
    title: duplicateTitle,
    workTypeTitle: item.workTypeTitle,
    workUnit: item.workUnit,
    workTypeId: item.workTypeId,
    workQuantity: item.workQuantity,
    dismantleQuantity: item.dismantleQuantity,
    ...phaseFieldState('assembly', {
      ...getPhaseFields(item, 'assembly'),
      personHoursByDate: item.assemblyPersonHoursByDate ? { ...item.assemblyPersonHoursByDate } : undefined,
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    ...phaseFieldState('dismantle', {
      ...getPhaseFields(item, 'dismantle'),
      personHoursByDate: item.dismantlePersonHoursByDate ? { ...item.dismantlePersonHoursByDate } : undefined,
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),

    rationale: null,
    reviewNote: null,
    removedFromSource: item.removedFromSource,
    amendmentNote: item.amendmentNote,
    amendedAt: item.amendedAt,
    tagIds: item.tagIds ? [...item.tagIds] : [],
  };
}

// ---------------------------------------------------------------------------
// Plan mutations
// ---------------------------------------------------------------------------

/** Activate a plan (freeze for execution). */
export function activatePlan(plan: Plan): Plan {
  const now = nowUtc();
  return {
    ...plan,
    status: 'active',
    activatedAt: now,
    reviewedAt: null,
    sessionClosedAt: null,
    updatedAt: now,
  };
}

/** Revert an active plan back to draft. */
export function revertToDraft(plan: Plan): Plan {
  return {
    ...plan,
    status: 'draft',
    activatedAt: null,
    handedOffAt: null,
    reviewedAt: null,
    updatedAt: nowUtc(),
  };
}

/** Record that the plan was handed off to a field/floor manager. */
export function handOffPlan(plan: Plan): Plan {
  const now = nowUtc();
  return { ...plan, handedOffAt: now, updatedAt: now };
}

/** Update a line item within a plan. Returns a new plan. */
export function updatePlanLineItem(
  plan: Plan,
  lineItemId: string,
  updates: Partial<Omit<PlanLineItem, 'id'>>,
): Plan {
  return {
    ...plan,
    lineItems: plan.lineItems.map((item) =>
      item.id === lineItemId ? { ...item, ...updates } : item,
    ),
    updatedAt: nowUtc(),
  };
}

/** Add a line item to a plan. */
export function addLineItemToPlan(plan: Plan, item: PlanLineItem): Plan {
  return {
    ...plan,
    lineItems: [...plan.lineItems, item],
    updatedAt: nowUtc(),
  };
}

/** Add multiple line items to a plan in a single update. */
export function addLineItemsToPlan(plan: Plan, items: PlanLineItem[]): Plan {
  return {
    ...plan,
    lineItems: [...plan.lineItems, ...items],
    updatedAt: nowUtc(),
  };
}

/** Remove a line item from a plan. */
export function removeLineItemFromPlan(plan: Plan, lineItemId: string): Plan {
  return {
    ...plan,
    lineItems: plan.lineItems.filter((item) => item.id !== lineItemId),
    updatedAt: nowUtc(),
  };
}

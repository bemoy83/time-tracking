/**
 * Planning workspace data model.
 *
 * A Plan is a collection of work packages (line items) with editable
 * assumptions. Plans can be in planner states ('draft' | 'active' | 'reviewed')
 * or executor states ('received' | 'session-closed').
 *
 * Each line item is phase-agnostic: it carries per-phase assumptions (rate,
 * crew, time) for both build-up and tear-down. A phase with rate=0 and
 * crew=0 and timeHours=0 is considered inactive.
 */

import type { WorkUnit, BuildPhase } from '../types';
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
  /** Override quantity for tear-down when unlinked from build-up. */
  tearDownQuantity?: number | null;

  // Build-up assumptions
  /** Productivity rate for build-up (units/person-hr). 0 = phase not applicable. */
  buildUpRate: number;
  buildUpCrew: number;
  buildUpTimeHours: number;
  buildUpRateSource: RateSource;

  // Tear-down assumptions
  /** Productivity rate for tear-down (units/person-hr). 0 = phase not applicable. */
  tearDownRate: number;
  tearDownCrew: number;
  tearDownTimeHours: number;
  tearDownRateSource: RateSource;

  // Build-up scheduling (independent per phase)
  buildUpScheduledStart: string | null;
  buildUpScheduledEnd: string | null;
  buildUpOriginalScheduledStart: string | null;
  buildUpOriginalScheduledEnd: string | null;
  buildUpCrewByDate?: Record<string, number>;

  // Tear-down scheduling (independent per phase)
  tearDownScheduledStart: string | null;
  tearDownScheduledEnd: string | null;
  tearDownOriginalScheduledStart: string | null;
  tearDownOriginalScheduledEnd: string | null;
  tearDownCrewByDate?: Record<string, number>;

  // Build-up execution state
  buildUpExecutionStatus: LineItemExecutionStatus;
  buildUpBlockReason: string | null;
  buildUpBlockCategory: BlockCategory | null;
  buildUpExecutorNote: string | null;
  buildUpDeferredNote: string | null;

  // Tear-down execution state
  tearDownExecutionStatus: LineItemExecutionStatus;
  tearDownBlockReason: string | null;
  tearDownBlockCategory: BlockCategory | null;
  tearDownExecutorNote: string | null;
  tearDownDeferredNote: string | null;

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
  crewByDate: Record<string, number> | undefined;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
}

/** Read all per-phase fields for the given phase. */
export function getPhaseFields(item: PlanLineItem, phase: BuildPhase): PhaseFields {
  if (phase === 'build-up') {
    return {
      rate: item.buildUpRate,
      crew: item.buildUpCrew,
      timeHours: item.buildUpTimeHours,
      rateSource: item.buildUpRateSource,
      scheduledStart: item.buildUpScheduledStart,
      scheduledEnd: item.buildUpScheduledEnd,
      originalScheduledStart: item.buildUpOriginalScheduledStart,
      originalScheduledEnd: item.buildUpOriginalScheduledEnd,
      crewByDate: item.buildUpCrewByDate,
      executionStatus: item.buildUpExecutionStatus,
      blockReason: item.buildUpBlockReason,
      blockCategory: item.buildUpBlockCategory,
      executorNote: item.buildUpExecutorNote,
      deferredNote: item.buildUpDeferredNote,
    };
  }
  return {
    rate: item.tearDownRate,
    crew: item.tearDownCrew,
    timeHours: item.tearDownTimeHours,
    rateSource: item.tearDownRateSource,
    scheduledStart: item.tearDownScheduledStart,
    scheduledEnd: item.tearDownScheduledEnd,
    originalScheduledStart: item.tearDownOriginalScheduledStart,
    originalScheduledEnd: item.tearDownOriginalScheduledEnd,
    crewByDate: item.tearDownCrewByDate,
    executionStatus: item.tearDownExecutionStatus,
    blockReason: item.tearDownBlockReason,
    blockCategory: item.tearDownBlockCategory,
    executorNote: item.tearDownExecutorNote,
    deferredNote: item.tearDownDeferredNote,
  };
}

/** True when a phase has any non-zero rate, crew, or time. */
export function isPhaseActive(item: PlanLineItem, phase: BuildPhase): boolean {
  const { rate, crew, timeHours } = getPhaseFields(item, phase);
  return rate > 0 || crew > 0 || timeHours > 0;
}

/** Return the effective quantity for a given phase (tear-down may override). */
export function getPhaseQuantity(item: PlanLineItem, phase: BuildPhase): number {
  if (phase === 'tear-down' && item.tearDownQuantity != null) {
    return item.tearDownQuantity;
  }
  return item.workQuantity;
}

/** Build the prefixed update object for a single phase's fields. */
export function phaseFieldUpdates(
  phase: BuildPhase,
  updates: Partial<PhaseFields>,
): Partial<PlanLineItem> {
  const prefix = phase === 'build-up' ? 'buildUp' : 'tearDown';
  const result: Record<string, unknown> = {};
  if (updates.rate !== undefined) result[`${prefix}Rate`] = updates.rate;
  if (updates.crew !== undefined) result[`${prefix}Crew`] = updates.crew;
  if (updates.timeHours !== undefined) result[`${prefix}TimeHours`] = updates.timeHours;
  if (updates.rateSource !== undefined) result[`${prefix}RateSource`] = updates.rateSource;
  if (updates.scheduledStart !== undefined) result[`${prefix}ScheduledStart`] = updates.scheduledStart;
  if (updates.scheduledEnd !== undefined) result[`${prefix}ScheduledEnd`] = updates.scheduledEnd;
  if (updates.originalScheduledStart !== undefined) result[`${prefix}OriginalScheduledStart`] = updates.originalScheduledStart;
  if (updates.originalScheduledEnd !== undefined) result[`${prefix}OriginalScheduledEnd`] = updates.originalScheduledEnd;
  if (updates.crewByDate !== undefined) result[`${prefix}CrewByDate`] = updates.crewByDate;
  if (updates.executionStatus !== undefined) result[`${prefix}ExecutionStatus`] = updates.executionStatus;
  if (updates.blockReason !== undefined) result[`${prefix}BlockReason`] = updates.blockReason;
  if (updates.blockCategory !== undefined) result[`${prefix}BlockCategory`] = updates.blockCategory;
  if (updates.executorNote !== undefined) result[`${prefix}ExecutorNote`] = updates.executorNote;
  if (updates.deferredNote !== undefined) result[`${prefix}DeferredNote`] = updates.deferredNote;
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
  /** Build-up start date (YYYY-MM-DD). */
  buildUpStartDate: string | null;
  /** Build-up end date (YYYY-MM-DD). */
  buildUpEndDate: string | null;
  /** Tear-down start date (YYYY-MM-DD). */
  tearDownStartDate: string | null;
  /** Tear-down end date (YYYY-MM-DD). */
  tearDownEndDate: string | null;
  /** Default crew size for schedule capacity math. */
  defaultCrewSize: number | null;
  /** Per-day work calendar across event period. */
  workCalendar: WorkCalendarDay[];
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when plan was activated. null if draft. */
  activatedAt: string | null;
  /** ISO timestamp when plan wrap-up review was finalized. */
  reviewedAt?: string | null;
  /** ISO timestamp when plan was imported onto executor device. */
  importedAt?: string | null;
  /** ISO timestamp when executor closed the session. */
  sessionClosedAt?: string | null;
}

export type PlanDateSpan = DateSpan;

export function hasPhaseDates(
  plan: Pick<Plan, 'buildUpStartDate' | 'buildUpEndDate' | 'tearDownStartDate' | 'tearDownEndDate'>,
): plan is Pick<Plan, 'buildUpStartDate' | 'buildUpEndDate' | 'tearDownStartDate' | 'tearDownEndDate'> & {
  buildUpStartDate: string;
  buildUpEndDate: string;
  tearDownStartDate: string;
  tearDownEndDate: string;
} {
  return hasPhaseDatesInternal(plan);
}

export function getPlanEffectiveSpan(
  plan: Pick<
    Plan,
    | 'eventStartDate'
    | 'eventEndDate'
    | 'buildUpStartDate'
    | 'buildUpEndDate'
    | 'tearDownStartDate'
    | 'tearDownEndDate'
  >,
): PlanDateSpan | null {
  return getPlanEffectiveSpanInternal(plan);
}

export function getPhaseSpan(
  plan: Pick<Plan, 'buildUpStartDate' | 'buildUpEndDate' | 'tearDownStartDate' | 'tearDownEndDate'>,
  phase: BuildPhase,
): PlanDateSpan | null {
  return getPhaseSpanInternal(plan, phase);
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
// Crew / schedule helpers (phase-aware)
// ---------------------------------------------------------------------------

/**
 * Effective crew count for a line item on a given date for a specific phase.
 * Returns crewByDate[date] if set, else phase crew for dates in the phase's
 * scheduled span, else 0.
 */
export function getEffectiveCrewForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
): number {
  const pf = getPhaseFields(item, phase);
  if (!pf.scheduledStart || !pf.scheduledEnd) return 0;
  if (date < pf.scheduledStart || date > pf.scheduledEnd) return 0;
  return pf.crewByDate?.[date] ?? pf.crew;
}

/**
 * Effective single crew value for a line item phase (for task creation, etc.).
 * Returns max of crewByDate values if present, else phase crew.
 */
export function lineItemEffectiveCrew(item: PlanLineItem, phase: BuildPhase): number {
  const pf = getPhaseFields(item, phase);
  const byDate = pf.crewByDate;
  if (!byDate) return pf.crew;
  const values = Object.values(byDate);
  if (values.length === 0) return pf.crew;
  return Math.max(...values, pf.crew);
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

/** Compute total person-hours for a plan (summing both phases). */
export function planTotalPersonHours(plan: Plan): number {
  return plan.lineItems.reduce((sum, item) => {
    const bu = item.buildUpTimeHours * item.buildUpCrew;
    const td = item.tearDownTimeHours * item.tearDownCrew;
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
    buildUpStartDate: null,
    buildUpEndDate: null,
    tearDownStartDate: null,
    tearDownEndDate: null,
    defaultCrewSize: null,
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
  buildUpRate: number,
  tearDownRate: number,
  rateSource: RateSource = 'manual',
  workTypeId: string | null = null,
): PlanLineItem {
  const buildUpTimeHours = buildUpRate > 0 ? workQuantity / buildUpRate : 0;
  const tearDownTimeHours = tearDownRate > 0 ? workQuantity / tearDownRate : 0;
  return {
    id: generateId(),
    title,
    workTypeTitle,
    workUnit,
    workTypeId,
    workQuantity,
    tearDownQuantity: null,

    buildUpRate,
    buildUpCrew: buildUpRate > 0 ? 1 : 0,
    buildUpTimeHours,
    buildUpRateSource: rateSource,

    tearDownRate,
    tearDownCrew: tearDownRate > 0 ? 1 : 0,
    tearDownTimeHours,
    tearDownRateSource: rateSource,

    buildUpScheduledStart: null,
    buildUpScheduledEnd: null,
    buildUpOriginalScheduledStart: null,
    buildUpOriginalScheduledEnd: null,
    buildUpCrewByDate: undefined,

    tearDownScheduledStart: null,
    tearDownScheduledEnd: null,
    tearDownOriginalScheduledStart: null,
    tearDownOriginalScheduledEnd: null,
    tearDownCrewByDate: undefined,

    buildUpExecutionStatus: 'pending',
    buildUpBlockReason: null,
    buildUpBlockCategory: null,
    buildUpExecutorNote: null,
    buildUpDeferredNote: null,

    tearDownExecutionStatus: 'pending',
    tearDownBlockReason: null,
    tearDownBlockCategory: null,
    tearDownExecutorNote: null,
    tearDownDeferredNote: null,

    rationale: null,
    reviewNote: null,
    removedFromSource: false,
    amendmentNote: null,
    amendedAt: null,
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
    tearDownQuantity: item.tearDownQuantity,

    buildUpRate: item.buildUpRate,
    buildUpCrew: item.buildUpCrew,
    buildUpTimeHours: item.buildUpTimeHours,
    buildUpRateSource: item.buildUpRateSource,

    tearDownRate: item.tearDownRate,
    tearDownCrew: item.tearDownCrew,
    tearDownTimeHours: item.tearDownTimeHours,
    tearDownRateSource: item.tearDownRateSource,

    buildUpScheduledStart: item.buildUpScheduledStart,
    buildUpScheduledEnd: item.buildUpScheduledEnd,
    buildUpOriginalScheduledStart: item.buildUpOriginalScheduledStart,
    buildUpOriginalScheduledEnd: item.buildUpOriginalScheduledEnd,
    buildUpCrewByDate: item.buildUpCrewByDate ? { ...item.buildUpCrewByDate } : undefined,

    tearDownScheduledStart: item.tearDownScheduledStart,
    tearDownScheduledEnd: item.tearDownScheduledEnd,
    tearDownOriginalScheduledStart: item.tearDownOriginalScheduledStart,
    tearDownOriginalScheduledEnd: item.tearDownOriginalScheduledEnd,
    tearDownCrewByDate: item.tearDownCrewByDate ? { ...item.tearDownCrewByDate } : undefined,

    buildUpExecutionStatus: item.buildUpExecutionStatus,
    buildUpBlockReason: null,
    buildUpBlockCategory: null,
    buildUpExecutorNote: null,
    buildUpDeferredNote: null,

    tearDownExecutionStatus: item.tearDownExecutionStatus,
    tearDownBlockReason: null,
    tearDownBlockCategory: null,
    tearDownExecutorNote: null,
    tearDownDeferredNote: null,

    rationale: null,
    reviewNote: null,
    removedFromSource: item.removedFromSource,
    amendmentNote: item.amendmentNote,
    amendedAt: item.amendedAt,
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
    reviewedAt: null,
    updatedAt: nowUtc(),
  };
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

/** Remove a line item from a plan. */
export function removeLineItemFromPlan(plan: Plan, lineItemId: string): Plan {
  return {
    ...plan,
    lineItems: plan.lineItems.filter((item) => item.id !== lineItemId),
    updatedAt: nowUtc(),
  };
}

// ---------------------------------------------------------------------------
// Migration: convert old single-phase line items on plan load
// ---------------------------------------------------------------------------

/** Detect and migrate old single-phase PlanLineItem format to dual-phase. */
export function migrateLineItemToDualPhase(raw: Record<string, unknown>): PlanLineItem {
  // Already migrated: has buildUpRate field
  if ('buildUpRate' in raw && typeof raw.buildUpRate === 'number') {
    return raw as unknown as PlanLineItem;
  }

  // Old format detection: has buildPhase + productivityRate
  const oldPhase = (raw.buildPhase as string) ?? 'build-up';
  const oldRate = (raw.productivityRate as number) ?? 0;
  const oldCrew = (raw.crew as number) ?? 1;
  const oldTimeHours = (raw.timeHours as number) ?? 0;
  const oldRateSource = (raw.rateSource as RateSource) ?? 'manual';
  const oldScheduledStart = (raw.scheduledStart as string | null) ?? null;
  const oldScheduledEnd = (raw.scheduledEnd as string | null) ?? null;
  const oldOriginalScheduledStart = (raw.originalScheduledStart as string | null) ?? null;
  const oldOriginalScheduledEnd = (raw.originalScheduledEnd as string | null) ?? null;
  const oldCrewByDate = (raw.crewByDate as Record<string, number> | undefined) ?? undefined;
  const oldExecStatus = (raw.executionStatus as LineItemExecutionStatus) ?? 'pending';
  const oldBlockReason = (raw.blockReason as string | null) ?? null;
  const oldBlockCategory = (raw.blockCategory as BlockCategory | null) ?? null;
  const oldExecutorNote = (raw.executorNote as string | null) ?? null;
  const oldDeferredNote = (raw.deferredNote as string | null) ?? null;

  const isBuildUp = oldPhase === 'build-up';

  return {
    id: raw.id as string,
    title: raw.title as string,
    workTypeTitle: (raw.workTypeTitle as string) ?? '',
    workUnit: raw.workUnit as WorkUnit,
    workTypeId: (raw.workTypeId as string | null) ?? null,
    workQuantity: (raw.workQuantity as number) ?? 0,
    tearDownQuantity: null,

    buildUpRate: isBuildUp ? oldRate : 0,
    buildUpCrew: isBuildUp ? oldCrew : 0,
    buildUpTimeHours: isBuildUp ? oldTimeHours : 0,
    buildUpRateSource: isBuildUp ? oldRateSource : 'manual',

    tearDownRate: !isBuildUp ? oldRate : 0,
    tearDownCrew: !isBuildUp ? oldCrew : 0,
    tearDownTimeHours: !isBuildUp ? oldTimeHours : 0,
    tearDownRateSource: !isBuildUp ? oldRateSource : 'manual',

    buildUpScheduledStart: isBuildUp ? oldScheduledStart : null,
    buildUpScheduledEnd: isBuildUp ? oldScheduledEnd : null,
    buildUpOriginalScheduledStart: isBuildUp ? oldOriginalScheduledStart : null,
    buildUpOriginalScheduledEnd: isBuildUp ? oldOriginalScheduledEnd : null,
    buildUpCrewByDate: isBuildUp ? oldCrewByDate : undefined,

    tearDownScheduledStart: !isBuildUp ? oldScheduledStart : null,
    tearDownScheduledEnd: !isBuildUp ? oldScheduledEnd : null,
    tearDownOriginalScheduledStart: !isBuildUp ? oldOriginalScheduledStart : null,
    tearDownOriginalScheduledEnd: !isBuildUp ? oldOriginalScheduledEnd : null,
    tearDownCrewByDate: !isBuildUp ? oldCrewByDate : undefined,

    buildUpExecutionStatus: isBuildUp ? oldExecStatus : 'pending',
    buildUpBlockReason: isBuildUp ? oldBlockReason : null,
    buildUpBlockCategory: isBuildUp ? oldBlockCategory : null,
    buildUpExecutorNote: isBuildUp ? oldExecutorNote : null,
    buildUpDeferredNote: isBuildUp ? oldDeferredNote : null,

    tearDownExecutionStatus: !isBuildUp ? oldExecStatus : 'pending',
    tearDownBlockReason: !isBuildUp ? oldBlockReason : null,
    tearDownBlockCategory: !isBuildUp ? oldBlockCategory : null,
    tearDownExecutorNote: !isBuildUp ? oldExecutorNote : null,
    tearDownDeferredNote: !isBuildUp ? oldDeferredNote : null,

    rationale: (raw.rationale as string | null) ?? null,
    reviewNote: (raw.reviewNote as string | null) ?? null,
    removedFromSource: (raw.removedFromSource as boolean) ?? false,
    amendmentNote: (raw.amendmentNote as string | null) ?? null,
    amendedAt: (raw.amendedAt as string | null) ?? null,
  };
}

/** Migrate all line items in a plan from old single-phase format if needed. */
export function migratePlanLineItems(plan: Plan): Plan {
  const rawItems = plan.lineItems as unknown as Record<string, unknown>[];
  const needsMigration = rawItems.some(
    (raw) => 'buildPhase' in raw && !('buildUpRate' in raw),
  );
  if (!needsMigration) return plan;

  return {
    ...plan,
    lineItems: rawItems.map(migrateLineItemToDualPhase),
  };
}

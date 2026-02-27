/**
 * Planning workspace data model.
 *
 * A Plan is a collection of work packages (line items) with editable
 * assumptions. Plans can be in planner states ('draft' | 'active' | 'reviewed')
 * or executor states ('received' | 'session-closed').
 *
 * Each line item maps to a WorkType key for KPI-backed suggestions.
 */

import type { WorkUnit, BuildPhase } from '../types';
import { generateId, nowUtc } from '../types';
import type { WorkTypeKey } from '../kpi';

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

export interface PlanLineItem {
  id: string;
  /** Display name for the work package. */
  title: string;
  /** Work type fields — used for KPI lookup. */
  workTypeTitle: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  /** Reference to WorkType entity. null for legacy line items. */
  workTypeId: string | null;
  /** Editable assumptions. */
  workQuantity: number;
  crew: number;
  timeHours: number;
  productivityRate: number;
  /** Where the rate came from ('template' | 'historical' | 'manual'). */
  rateSource: 'template' | 'historical' | 'manual';
  /** Optional rationale note for this line item. */
  rationale: string | null;
  /** Optional post-execution review note for this line item. */
  reviewNote?: string | null;
  /** Executor-side execution state for Field Plan View. */
  executionStatus: LineItemExecutionStatus;
  /** Free-text blocked reason from executor. */
  blockReason: string | null;
  /** Optional normalized blocked reason category. */
  blockCategory: BlockCategory | null;
  /** Executor annotation from field context. */
  executorNote: string | null;
  /** Executor note when line item is deferred. */
  deferredNote: string | null;
  /**
   * True when the source line item was removed in an upstream re-import merge.
   * Kept visible as historical context on executor device.
   */
  removedFromSource: boolean;
  /** Scheduled start time (ISO UTC). null until scheduling feature is implemented. */
  scheduledStart: string | null;
  /** Scheduled end time (ISO UTC). null until scheduling feature is implemented. */
  scheduledEnd: string | null;
}

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  lineItems: PlanLineItem[];
  /** Event/project this plan belongs to. null = unassigned. */
  projectId: string | null;
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
  return {
    workTypeId: item.workTypeId,
    workTypeTitle: resolveLineItemWorkTypeTitle(item),
    workUnit: item.workUnit,
    buildPhase: item.buildPhase,
  };
}

/** Compute total person-hours for a plan. */
export function planTotalPersonHours(plan: Plan): number {
  return plan.lineItems.reduce((sum, item) => sum + item.timeHours * item.crew, 0);
}

/** Compute total work quantity for a plan (grouped by unit). */
export function planTotalsByUnit(plan: Plan): Map<WorkUnit, number> {
  const totals = new Map<WorkUnit, number>();
  for (const item of plan.lineItems) {
    totals.set(item.workUnit, (totals.get(item.workUnit) ?? 0) + item.workQuantity);
  }
  return totals;
}

/** Create a new empty draft plan. */
export function createPlan(title: string): Plan {
  const now = nowUtc();
  return {
    id: generateId(),
    title,
    status: 'draft',
    lineItems: [],
    projectId: null,
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
  };
}

/** Create a new line item with defaults. */
export function createLineItem(
  title: string,
  workTypeTitle: string,
  workUnit: WorkUnit,
  buildPhase: BuildPhase,
  workQuantity: number,
  productivityRate: number,
  rateSource: 'template' | 'historical' | 'manual' = 'manual',
  workTypeId: string | null = null,
): PlanLineItem {
  const timeHours = productivityRate > 0 ? workQuantity / productivityRate : 0;
  return {
    id: generateId(),
    title,
    workTypeTitle,
    workUnit,
    buildPhase,
    workTypeId,
    workQuantity,
    crew: 1,
    timeHours,
    productivityRate,
    rateSource,
    rationale: null,
    reviewNote: null,
    executionStatus: 'pending',
    blockReason: null,
    blockCategory: null,
    executorNote: null,
    deferredNote: null,
    removedFromSource: false,
    scheduledStart: null,
    scheduledEnd: null,
  };
}

/** Duplicate a line item, preserving work-type fields and assumptions. */
export function duplicateLineItem(item: PlanLineItem): PlanLineItem {
  const trimmedTitle = item.title.trim();
  const baseTitle = trimmedTitle.replace(/\s*\(copy\)\s*$/i, '').trim();
  const duplicateTitle = `${baseTitle || trimmedTitle} (copy)`.trim();

  return {
    id: generateId(),
    title: duplicateTitle,
    workTypeTitle: item.workTypeTitle,
    workUnit: item.workUnit,
    buildPhase: item.buildPhase,
    workTypeId: item.workTypeId,
    workQuantity: item.workQuantity,
    crew: item.crew,
    timeHours: item.timeHours,
    productivityRate: item.productivityRate,
    rateSource: item.rateSource,
    rationale: null,
    reviewNote: null,
    executionStatus: item.executionStatus,
    blockReason: null,
    blockCategory: null,
    executorNote: null,
    deferredNote: null,
    removedFromSource: item.removedFromSource,
    scheduledStart: item.scheduledStart,
    scheduledEnd: item.scheduledEnd,
  };
}

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

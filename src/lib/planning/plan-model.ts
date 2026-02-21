/**
 * Planning workspace data model.
 *
 * A Plan is a collection of work packages (line items) with editable
 * assumptions. Plans can be in 'draft' or 'locked' status.
 *
 * Each line item maps to a WorkType key for KPI-backed suggestions.
 */

import type { WorkCategory, WorkUnit, BuildPhase } from '../types';
import { generateId, nowUtc } from '../types';
import type { WorkTypeKey } from '../kpi';

export type PlanStatus = 'draft' | 'locked';

export interface PlanLineItem {
  id: string;
  /** Display name for the work package. */
  title: string;
  /** Work type fields — used for KPI lookup. */
  workCategory: WorkCategory;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  /** Editable assumptions. */
  workQuantity: number;
  crew: number;
  timeHours: number;
  productivityRate: number;
  /** Where the rate came from ('template' | 'historical' | 'manual'). */
  rateSource: 'template' | 'historical' | 'manual';
  /** Optional rationale note for this line item. */
  rationale: string | null;
}

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  lineItems: PlanLineItem[];
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when plan was locked. null if draft. */
  lockedAt: string | null;
}

/** Get the WorkTypeKey for a line item (for KPI lookups). */
export function lineItemWorkTypeKey(item: PlanLineItem): WorkTypeKey {
  return {
    workCategory: item.workCategory,
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
    createdAt: now,
    updatedAt: now,
    lockedAt: null,
  };
}

/** Create a new line item with defaults. */
export function createLineItem(
  title: string,
  workCategory: WorkCategory,
  workUnit: WorkUnit,
  buildPhase: BuildPhase,
  workQuantity: number,
  productivityRate: number,
  rateSource: 'template' | 'historical' | 'manual' = 'manual',
): PlanLineItem {
  const timeHours = productivityRate > 0 ? workQuantity / productivityRate : 0;
  return {
    id: generateId(),
    title,
    workCategory,
    workUnit,
    buildPhase,
    workQuantity,
    crew: 1,
    timeHours,
    productivityRate,
    rateSource,
    rationale: null,
  };
}

/** Lock a plan (freeze for execution). */
export function lockPlan(plan: Plan): Plan {
  const now = nowUtc();
  return {
    ...plan,
    status: 'locked',
    lockedAt: now,
    updatedAt: now,
  };
}

/** Unlock a plan back to draft. */
export function unlockPlan(plan: Plan): Plan {
  return {
    ...plan,
    status: 'draft',
    lockedAt: null,
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

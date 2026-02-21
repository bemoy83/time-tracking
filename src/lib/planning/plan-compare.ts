/**
 * Plan scenario comparison — compares two plan snapshots side by side.
 * Shows per-line-item deltas and total plan differences.
 */

import type { Plan, PlanLineItem } from './plan-model';
import { planTotalPersonHours } from './plan-model';

export interface LineItemDelta {
  lineItemId: string;
  title: string;
  /** 'added' if only in plan B, 'removed' if only in plan A, 'changed' or 'unchanged'. */
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  /** Field-level deltas for changed items. */
  changes: FieldDelta[];
}

export interface FieldDelta {
  field: string;
  valueA: number;
  valueB: number;
  delta: number;
  percentChange: number | null; // null if valueA is 0
}

export interface PlanComparison {
  planATitle: string;
  planBTitle: string;
  lineItems: LineItemDelta[];
  totalDelta: {
    personHoursA: number;
    personHoursB: number;
    personHoursDelta: number;
    lineItemsA: number;
    lineItemsB: number;
  };
}

function computeFieldDelta(field: string, a: number, b: number): FieldDelta {
  return {
    field,
    valueA: a,
    valueB: b,
    delta: b - a,
    percentChange: a !== 0 ? (b - a) / a : null,
  };
}

function diffLineItems(a: PlanLineItem, b: PlanLineItem): FieldDelta[] {
  const deltas: FieldDelta[] = [];

  if (a.workQuantity !== b.workQuantity) {
    deltas.push(computeFieldDelta('workQuantity', a.workQuantity, b.workQuantity));
  }
  if (a.crew !== b.crew) {
    deltas.push(computeFieldDelta('crew', a.crew, b.crew));
  }
  if (a.timeHours !== b.timeHours) {
    deltas.push(computeFieldDelta('timeHours', a.timeHours, b.timeHours));
  }
  if (a.productivityRate !== b.productivityRate) {
    deltas.push(computeFieldDelta('productivityRate', a.productivityRate, b.productivityRate));
  }

  return deltas;
}

/**
 * Compare two plans and produce a side-by-side diff.
 * Matches line items by title + workCategory + workUnit + buildPhase.
 */
export function comparePlans(planA: Plan, planB: Plan): PlanComparison {
  const keyFn = (item: PlanLineItem): string =>
    `${item.title}::${item.workCategory}:${item.workUnit}:${item.buildPhase}`;

  const mapA = new Map(planA.lineItems.map((i) => [keyFn(i), i]));
  const mapB = new Map(planB.lineItems.map((i) => [keyFn(i), i]));

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const lineItems: LineItemDelta[] = [];

  for (const key of allKeys) {
    const a = mapA.get(key);
    const b = mapB.get(key);

    if (a && b) {
      const changes = diffLineItems(a, b);
      lineItems.push({
        lineItemId: a.id,
        title: a.title,
        status: changes.length > 0 ? 'changed' : 'unchanged',
        changes,
      });
    } else if (a && !b) {
      lineItems.push({
        lineItemId: a.id,
        title: a.title,
        status: 'removed',
        changes: [],
      });
    } else if (!a && b) {
      lineItems.push({
        lineItemId: b.id,
        title: b.title,
        status: 'added',
        changes: [],
      });
    }
  }

  return {
    planATitle: planA.title,
    planBTitle: planB.title,
    lineItems,
    totalDelta: {
      personHoursA: planTotalPersonHours(planA),
      personHoursB: planTotalPersonHours(planB),
      personHoursDelta: planTotalPersonHours(planB) - planTotalPersonHours(planA),
      lineItemsA: planA.lineItems.length,
      lineItemsB: planB.lineItems.length,
    },
  };
}

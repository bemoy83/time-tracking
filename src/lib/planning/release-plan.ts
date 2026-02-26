/**
 * Release-to-Today: convert locked plan line items into active tasks.
 */

import type { PlanLineItem } from './plan-model';
import type { CreateTaskInput } from '../stores/task-store';

/**
 * Map a PlanLineItem to a CreateTaskInput for task-store.createTask().
 * Keeps planning ↔ task boundary clean and testable.
 */
export function lineItemToCreateTaskInput(
  item: PlanLineItem,
  overrides?: { projectId?: string | null; planId?: string },
): CreateTaskInput {
  return {
    title: item.title,
    projectId: overrides?.projectId ?? undefined,
    sourcePlanId: overrides?.planId ?? undefined,
    sourceLineItemId: item.id,
    workTypeId: item.workTypeId ?? undefined,
    workQuantity: item.workQuantity,
    workUnit: item.workUnit,
    defaultWorkers: item.crew,
    targetProductivity: item.productivityRate,
    buildPhase: item.buildPhase,
    estimatedMinutes: Math.round(item.timeHours * 60) || undefined,
  };
}

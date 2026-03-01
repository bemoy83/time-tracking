/**
 * Release-to-Today: convert locked plan line items into active tasks.
 */

import type { PlanLineItem } from './plan-model';
import type { CreateTaskInput } from '../stores/task-store';
import {
  lineItemToWorkPackageCore,
  workPackageCoreToCreateTaskInput,
} from '../work-package-core';

/**
 * Map a PlanLineItem to a CreateTaskInput for task-store.createTask().
 * Keeps planning <-> task boundary clean and testable.
 */
export function lineItemToCreateTaskInput(
  item: PlanLineItem,
  overrides?: { projectId?: string | null; planId?: string },
): CreateTaskInput {
  const core = lineItemToWorkPackageCore(item);
  return workPackageCoreToCreateTaskInput(core, {
    projectId: overrides?.projectId,
    sourcePlanId: overrides?.planId,
    sourceLineItemId: item.id,
  });
}

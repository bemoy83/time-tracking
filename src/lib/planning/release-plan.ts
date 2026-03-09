/**
 * Release-to-Today: convert locked plan line items into active tasks.
 */

import type { PlanLineItem } from './plan-model';
import type { CreateTaskInput } from '../stores/task-store';
import {
  lineItemPhaseToWorkPackageCore,
  workPackageCoreToCreateTaskInput,
} from '../work-package-core';
import { BUILD_PHASE_LABELS, type BuildPhase } from '../types';

/**
 * Map a PlanLineItem to a CreateTaskInput for task-store.createTask().
 * Keeps planning <-> task boundary clean and testable.
 */
export function lineItemToCreateTaskInput(
  item: PlanLineItem,
  phase: BuildPhase,
  overrides?: { projectId?: string | null; planId?: string },
): CreateTaskInput {
  const core = lineItemPhaseToWorkPackageCore(item, phase);
  const coreWithPhaseTitle = {
    ...core,
    title: `${item.title} — ${BUILD_PHASE_LABELS[phase]}`,
  };
  return workPackageCoreToCreateTaskInput(coreWithPhaseTitle, {
    projectId: overrides?.projectId,
    sourcePlanId: overrides?.planId,
    sourceLineItemId: item.id,
  });
}

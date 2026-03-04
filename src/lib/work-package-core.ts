import type { BuildPhase, Task, WorkType, WorkUnit } from './types';
import type { PlanLineItem } from './planning/plan-model';
import type { CreateTaskInput } from './stores/task-store';
import type { WorkTypeKey } from './kpi';

/** Shared work-package fields used by PlanLineItem, Task, and CreateTaskInput. */
export interface WorkPackageCore {
  title: string;
  workTypeId: string | null;
  /** Optional - Task lacks this unless resolved from WorkType lookup. */
  workTypeTitle?: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  workQuantity: number;
  crew: number;
  productivityRate: number;
  /** Time estimate in minutes. */
  estimatedMinutes: number;
  blockReason: string | null;
}

/** Canonical key used for WorkType-backed grouping and lookups. */
export type WorkPackageWorkTypeKey = {
  workTypeId: string | null;
  workTypeTitle?: string;
  title?: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase | null;
};

/** Build a KPI-compatible work-type key from shared work-package fields. */
export function workPackageWorkTypeKey(input: WorkPackageWorkTypeKey): WorkTypeKey {
  const resolvedTitle = input.workTypeTitle && input.workTypeTitle.trim().length > 0
    ? input.workTypeTitle
    : (input.title ?? '');
  return {
    workTypeId: input.workTypeId,
    workTypeTitle: resolvedTitle,
    workUnit: input.workUnit,
    buildPhase: input.buildPhase,
  };
}

/** Shared line-item keying helper used by planning suggestions and tests. */
export function lineItemWorkTypeKey(
  item: Pick<PlanLineItem, 'workTypeId' | 'workTypeTitle' | 'title' | 'workUnit' | 'buildPhase'>,
): WorkTypeKey {
  return workPackageWorkTypeKey({
    workTypeId: item.workTypeId,
    workTypeTitle: item.workTypeTitle,
    title: item.title,
    workUnit: item.workUnit,
    buildPhase: item.buildPhase,
  });
}

export function lineItemToWorkPackageCore(item: PlanLineItem): WorkPackageCore {
  return {
    title: item.title,
    workTypeId: item.workTypeId,
    workTypeTitle: item.workTypeTitle,
    workUnit: item.workUnit,
    buildPhase: item.buildPhase,
    workQuantity: item.workQuantity,
    crew: item.crew,
    productivityRate: item.productivityRate,
    estimatedMinutes: Math.round(item.timeHours * 60),
    blockReason: item.blockReason,
  };
}

export function taskToWorkPackageCore(task: Task, workType?: WorkType | null): WorkPackageCore {
  return {
    title: task.title,
    workTypeId: task.workTypeId,
    workTypeTitle: workType?.title,
    workUnit: task.workUnit ?? workType?.workUnit ?? 'm2',
    buildPhase: task.buildPhase ?? workType?.buildPhase ?? 'build-up',
    workQuantity: task.workQuantity ?? 0,
    crew: task.crew ?? 1,
    productivityRate: task.targetProductivity ?? 0,
    estimatedMinutes: task.estimatedMinutes ?? 0,
    blockReason: task.blockReason,
  };
}

export function workPackageCoreToCreateTaskInput(
  core: WorkPackageCore,
  overrides?: {
    projectId?: string | null;
    sourcePlanId?: string;
    sourceLineItemId?: string;
  },
): CreateTaskInput {
  return {
    title: core.title,
    projectId: overrides?.projectId ?? undefined,
    sourcePlanId: overrides?.sourcePlanId ?? undefined,
    sourceLineItemId: overrides?.sourceLineItemId,
    workTypeId: core.workTypeId ?? undefined,
    workQuantity: core.workQuantity,
    workUnit: core.workUnit,
    crew: core.crew,
    targetProductivity: core.productivityRate,
    buildPhase: core.buildPhase,
    estimatedMinutes: core.estimatedMinutes > 0 ? core.estimatedMinutes : undefined,
  };
}

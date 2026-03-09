import { getAllTasks, getPlan, updatePlan, updateTask } from '../db';
import { updatePlanLineItem, phaseFieldUpdates, type BlockCategory } from './plan-model';
import { nowUtc, type BuildPhase, type Task } from '../types';
import { refreshTasks } from '../stores/task-store';

function hasPlanLink(task: Task): task is Task & { sourcePlanId: string; sourceLineItemId: string } {
  return Boolean(task.sourcePlanId && task.sourceLineItemId);
}

function isSameLineItem(task: Task, planId: string, lineItemId: string): boolean {
  return task.sourcePlanId === planId && task.sourceLineItemId === lineItemId;
}

function resolvePhase(task: Task): BuildPhase {
  return task.buildPhase === 'tear-down' ? 'tear-down' : 'build-up';
}

export async function syncTaskBlockToPlan(task: Task): Promise<void> {
  if (!hasPlanLink(task)) return;

  const plan = await getPlan(task.sourcePlanId);
  if (!plan) return;

  const lineItem = plan.lineItems.find((item) => item.id === task.sourceLineItemId);
  if (!lineItem) return;

  const phase = resolvePhase(task);
  const reason = task.blockReason;
  const nextPlan = updatePlanLineItem(plan, lineItem.id, phaseFieldUpdates(phase, {
    executionStatus: 'blocked',
    blockReason: reason,
    blockCategory: null,
  }));
  await updatePlan(nextPlan);

  const allTasks = await getAllTasks();
  const linkedTasks = allTasks.filter((candidate) =>
    isSameLineItem(candidate, task.sourcePlanId, task.sourceLineItemId),
  );
  if (linkedTasks.length > 0) {
    const updatedAt = nowUtc();
    await Promise.all(
      linkedTasks.map((linkedTask) =>
        updateTask({
          ...linkedTask,
          status: 'blocked',
          blockReason: reason,
          updatedAt,
        }),
      ),
    );
  }

  await refreshTasks();
}

export async function syncTaskUnblockToPlan(task: Task): Promise<void> {
  if (!hasPlanLink(task)) return;

  const plan = await getPlan(task.sourcePlanId);
  if (!plan) return;

  const lineItem = plan.lineItems.find((item) => item.id === task.sourceLineItemId);
  if (!lineItem) return;

  const phase = resolvePhase(task);
  const nextPlan = updatePlanLineItem(plan, lineItem.id, phaseFieldUpdates(phase, {
    executionStatus: 'pending',
    blockReason: null,
    blockCategory: null,
  }));
  await updatePlan(nextPlan);

  const allTasks = await getAllTasks();
  const linkedTasks = allTasks.filter((candidate) =>
    isSameLineItem(candidate, task.sourcePlanId, task.sourceLineItemId),
  );
  if (linkedTasks.length > 0) {
    const updatedAt = nowUtc();
    await Promise.all(
      linkedTasks.map((linkedTask) =>
        updateTask({
          ...linkedTask,
          status: 'active',
          blockReason: null,
          updatedAt,
        }),
      ),
    );
  }

  await refreshTasks();
}

export async function syncLineItemBlockToTasks(
  planId: string,
  lineItemId: string,
  blockReason: string,
  blockCategory: BlockCategory | null,
): Promise<void> {
  void blockCategory;

  const allTasks = await getAllTasks();
  const linkedTasks = allTasks.filter((candidate) => isSameLineItem(candidate, planId, lineItemId));
  if (linkedTasks.length > 0) {
    const updatedAt = nowUtc();
    await Promise.all(
      linkedTasks.map((linkedTask) =>
        updateTask({
          ...linkedTask,
          status: 'blocked',
          blockReason: blockReason,
          updatedAt,
        }),
      ),
    );
  }

  await refreshTasks();
}

export async function syncLineItemUnblockToTasks(
  planId: string,
  lineItemId: string,
): Promise<void> {
  const allTasks = await getAllTasks();
  const linkedTasks = allTasks.filter((candidate) => isSameLineItem(candidate, planId, lineItemId));
  if (linkedTasks.length > 0) {
    const updatedAt = nowUtc();
    await Promise.all(
      linkedTasks.map((linkedTask) =>
        updateTask({
          ...linkedTask,
          status: 'active',
          blockReason: null,
          updatedAt,
        }),
      ),
    );
  }

  await refreshTasks();
}

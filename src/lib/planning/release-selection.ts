import type { CreateTaskInput } from '../stores/task-store';
import type { Plan } from './plan-model';
import { lineItemToCreateTaskInput } from './release-plan';

export function selectedPlanItemsToCreateTaskInputs(
  plans: Plan[],
  selectedItemIds: Set<string>,
): CreateTaskInput[] {
  const inputs: CreateTaskInput[] = [];
  for (const plan of plans) {
    for (const item of plan.lineItems) {
      if (selectedItemIds.has(item.id)) {
        inputs.push(
          lineItemToCreateTaskInput(item, {
            projectId: plan.projectId ?? undefined,
            planId: plan.id,
          }),
        );
      }
    }
  }
  return inputs;
}

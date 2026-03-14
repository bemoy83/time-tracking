import type { CreateTaskInput } from '../stores/task-store';
import type { Plan } from './plan-model';
import { isPhaseActive } from './plan-model';
import { lineItemToCreateTaskInput } from './release-plan';
import { BUILD_PHASES, type BuildPhase } from '../types';

export interface PlanLineItemPhaseSelection {
  planId: string;
  lineItemId: string;
  phase: BuildPhase;
}

const PLAN_SELECTION_SEPARATOR = '::';

export function encodePlanLineItemPhaseSelection(selection: PlanLineItemPhaseSelection): string {
  return [
    selection.planId,
    selection.lineItemId,
    selection.phase,
  ].join(PLAN_SELECTION_SEPARATOR);
}

export function decodePlanLineItemPhaseSelection(
  token: string,
): PlanLineItemPhaseSelection | null {
  const [planId, lineItemId, phase] = token.split(PLAN_SELECTION_SEPARATOR);
  if (!planId || !lineItemId) return null;
  if (phase !== 'assembly' && phase !== 'dismantle') return null;
  return {
    planId,
    lineItemId,
    phase,
  };
}

export function selectedPlanItemsToCreateTaskInputs(
  plans: Plan[],
  selectedSelections: Set<string>,
): CreateTaskInput[] {
  const inputs: CreateTaskInput[] = [];
  const selectedByPlan = new Map<string, Map<string, Set<BuildPhase>>>();

  for (const token of selectedSelections) {
    const selection = decodePlanLineItemPhaseSelection(token);
    if (!selection) continue;

    if (!selectedByPlan.has(selection.planId)) {
      selectedByPlan.set(selection.planId, new Map());
    }
    const byLineItem = selectedByPlan.get(selection.planId)!;
    if (!byLineItem.has(selection.lineItemId)) {
      byLineItem.set(selection.lineItemId, new Set());
    }
    byLineItem.get(selection.lineItemId)!.add(selection.phase);
  }

  for (const plan of plans) {
    const selectedInPlan = selectedByPlan.get(plan.id);
    if (!selectedInPlan) continue;

    for (const item of plan.lineItems) {
      const phases = selectedInPlan.get(item.id);
      if (!phases || phases.size === 0) continue;

      for (const phase of BUILD_PHASES) {
        if (!phases.has(phase) || !isPhaseActive(item, phase)) {
          continue;
        }
        inputs.push(
          lineItemToCreateTaskInput(item, phase, {
            projectId: plan.projectId ?? undefined,
            planId: plan.id,
          }),
        );
      }
    }
  }
  return inputs;
}

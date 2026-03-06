import type { FieldPlanLineItemSummary } from './field-plan-model';

export type FormMode =
  | { kind: 'actions'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'block'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'defer'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'note'; lineItem: FieldPlanLineItemSummary };

export interface FieldPlanStatusGroups {
  inProgress: FieldPlanLineItemSummary[];
  blocked: FieldPlanLineItemSummary[];
  pending: FieldPlanLineItemSummary[];
  completed: FieldPlanLineItemSummary[];
  deferred: FieldPlanLineItemSummary[];
}

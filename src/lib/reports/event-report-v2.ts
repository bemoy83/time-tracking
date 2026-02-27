import type { Plan } from '../planning/plan-model';
import type { WrapUpV2Projection } from '../planning/wrap-up-v2-model';

export interface EventReportV2 {
  planTitle: string;
  reviewedAt: string | null;
  summary: {
    plannedPersonHours: number;
    actualPersonHours: number;
    deliveredCount: number;
    deferredCount: number;
    blockedCount: number;
    unplannedCount: number;
  };
  delivered: WrapUpV2Projection['lineItems'];
  notDelivered: WrapUpV2Projection['lineItems'];
  disruptions: WrapUpV2Projection['lineItems'];
  unplanned: WrapUpV2Projection['unplanned'];
}

export function buildEventReportV2(plan: Plan, projection: WrapUpV2Projection): EventReportV2 {
  const delivered = projection.lineItems.filter((item) => item.executionStatus === 'completed');
  const notDelivered = projection.lineItems.filter((item) => item.executionStatus === 'deferred');
  const disruptions = projection.lineItems.filter((item) => item.executionStatus === 'blocked');

  const plannedPersonHours = projection.lineItems.reduce((sum, item) => sum + item.plannedPersonHours, 0);
  const actualPersonHours = projection.lineItems.reduce((sum, item) => sum + item.actualPersonHours, 0) +
    projection.unplanned.reduce((sum, item) => sum + item.personHours, 0);

  return {
    planTitle: plan.title,
    reviewedAt: plan.reviewedAt ?? null,
    summary: {
      plannedPersonHours: Number(plannedPersonHours.toFixed(2)),
      actualPersonHours: Number(actualPersonHours.toFixed(2)),
      deliveredCount: delivered.length,
      deferredCount: notDelivered.length,
      blockedCount: disruptions.length,
      unplannedCount: projection.unplanned.length,
    },
    delivered,
    notDelivered,
    disruptions,
    unplanned: projection.unplanned,
  };
}

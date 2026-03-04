import { isPlanArchived } from '../plan-lifecycle';
import type { Plan } from '../plan-model';
import { BUILD_PHASE_LABELS, BUILD_PHASES } from '../../types';
import type { SharedScheduleRow } from './shared-schedule-types';

function comparePlanOrder(a: Plan, b: Plan): number {
  const titleCmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (titleCmp !== 0) return titleCmp;
  return a.id.localeCompare(b.id);
}

export function buildSharedRows(plans: Plan[]): SharedScheduleRow[] {
  const rows: SharedScheduleRow[] = [];
  const sortedPlans = [...plans].sort(comparePlanOrder);

  for (const plan of sortedPlans) {
    const readOnly = isPlanArchived(plan);
    const projectRowId = `project:${plan.id}`;

    rows.push({
      id: projectRowId,
      type: 'project',
      planId: plan.id,
      label: plan.title,
      depth: 0,
      projectRowId,
      readOnly,
      itemCount: plan.lineItems.length,
    });

    for (const phase of BUILD_PHASES) {
      const phaseItems = plan.lineItems.filter((item) => item.buildPhase === phase);
      if (phaseItems.length === 0) continue;

      const phaseRowId = `phase:${plan.id}:${phase}`;
      rows.push({
        id: phaseRowId,
        type: 'phase',
        planId: plan.id,
        label: BUILD_PHASE_LABELS[phase],
        depth: 1,
        projectRowId,
        phaseRowId,
        phase,
        readOnly,
        itemCount: phaseItems.length,
      });

      for (const item of phaseItems) {
        rows.push({
          id: `item:${plan.id}:${item.id}`,
          type: 'item',
          planId: plan.id,
          label: item.title,
          depth: 2,
          projectRowId,
          phaseRowId,
          phase,
          lineItemId: item.id,
          readOnly,
        });
      }
    }
  }

  return rows;
}

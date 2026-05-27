import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPlan } from '../../../lib/planning/plan-model';
import { PlanContextStrip, getPlanContextPhases } from './PlanContextStrip';

describe('PlanContextStrip', () => {
  it('renders project accent, status, and phase chips from a plan fixture', () => {
    const plan = createPlan('Context Plan');
    plan.status = 'active';
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-03';
    plan.eventStartDate = '2026-03-04';
    plan.eventEndDate = '2026-03-04';
    plan.dismantleStartDate = '2026-03-05';
    plan.dismantleEndDate = '2026-03-06';

    const html = renderToStaticMarkup(
      <PlanContextStrip
        title="Context Plan"
        status="ready"
        projectAccentColor="#3366ff"
        phases={getPlanContextPhases(plan)}
      />,
    );

    expect(html).toContain('planning-workspace__plan-context-bar--has-project');
    expect(html).toContain('Context Plan');
    expect(html).toContain('READY');
    expect(html).toContain('Assembly');
    expect(html).toContain('Event');
    expect(html).toContain('Dismantle');
  });
});

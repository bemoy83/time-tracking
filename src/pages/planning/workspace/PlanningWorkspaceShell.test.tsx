import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPlan, type Plan } from '../../../lib/planning/plan-model';
import { PlanningWorkspaceShell } from './PlanningWorkspaceShell';

function renderWorkspaceHtml(overrides: Partial<React.ComponentProps<typeof PlanningWorkspaceShell>> = {}) {
  const plan = createPlan('Plan A');
  return {
    plan,
    html: renderToStaticMarkup(
      <PlanningWorkspaceShell
        plans={[plan]}
        tasks={[]}
        projects={[]}
        workTypes={[]}
        kpis={[]}
        timeEntries={[]}
        timeEntriesByTask={new Map()}
        activePlan={null}
        activeTab="shared-schedule"
        hasLinkedTasks={false}
        wrapUpPlan={null}
        selectedPlanIdsForSharedSchedule={new Set()}
        onSelectPlan={vi.fn()}
        onCreatePlan={vi.fn()}
        onDeletePlan={vi.fn()}
        onSavePlan={vi.fn()}
        onSetActiveTab={vi.fn()}
        onSetSelectedPlanIdsForSharedSchedule={vi.fn()}
        onOpenInsights={vi.fn()}
        onOpenProgress={vi.fn()}
        onOpenWrapUp={vi.fn()}
        onCloseWrapUp={vi.fn()}
        onWrapUpCompleted={vi.fn()}
        {...overrides}
      />,
    ),
  };
}

describe('PlanningWorkspaceShell', () => {
  it('renders shared schedule tab with plan selection in the sidebar', () => {
    const { html } = renderWorkspaceHtml();

    expect(html).toContain('Shared Schedule');
    expect(html).toContain('Plan A');
    expect(html).toContain('planning-workspace__editor-canvas--full-bleed');
  });

  it('renders a single plan through the workspace frame and context strip', () => {
    const plan = createPlan('Plan A');
    plan.eventStartDate = '2026-03-04';
    plan.eventEndDate = '2026-03-05';
    const { html } = renderWorkspaceHtml({
      activePlan: plan,
      activeTab: 'edit',
    });

    expect(html).toContain('planning-workspace__main-inner');
    expect(html).toContain('planning-workspace__plan-context-bar');
    expect(html).toContain('Plan A');
    expect(html).toContain('Event');
  });

  it('renders wrap-up through the fill workspace frame', () => {
    const plan = createPlan('Plan A');
    const { html } = renderWorkspaceHtml({
      activePlan: plan,
      activeTab: 'review',
      wrapUpPlan: plan,
    });

    expect(html).toContain('planning-workspace__editor-canvas--fill');
  });

  it('renders the empty state through the workspace frame', () => {
    const { html } = renderWorkspaceHtml({
      plans: [] as Plan[],
      activePlan: null,
      activeTab: 'edit',
    });

    expect(html).toContain('planning-workspace__main-inner');
    expect(html).toContain('Create your first plan');
  });
});

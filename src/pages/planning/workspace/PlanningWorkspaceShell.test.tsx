import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPlan } from '../../../lib/planning/plan-model';
import { PlanningWorkspaceShell } from './PlanningWorkspaceShell';

describe('PlanningWorkspaceShell', () => {
  it('renders shared schedule tab content without an active plan', () => {
    const plan = createPlan('Plan A');

    const html = renderToStaticMarkup(
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
        archiveExpanded={false}
        sidebarCollapsed="expanded"
        onToggleArchive={vi.fn()}
        onToggleSidebar={vi.fn()}
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
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain('Shared Schedule');
    expect(html).toContain('Plan Selection');
  });
});

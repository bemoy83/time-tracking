/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { createPlan } from '../../../lib/planning/plan-model';
import { PlanningWorkspaceShell } from './PlanningWorkspaceShell';

vi.mock('../hooks/usePlanIdsWithImportedExecutionReturns', () => ({
  usePlanIdsWithImportedExecutionReturns: () => new Set<string>(),
}));

function createProps(
  overrides: Partial<ComponentProps<typeof PlanningWorkspaceShell>> = {},
): ComponentProps<typeof PlanningWorkspaceShell> {
  const plan = createPlan('Plan A');
  return {
    plans: [plan],
    tasks: [],
    projects: [],
    workTypes: [],
    kpis: [],
    timeEntries: [],
    timeEntriesByTask: new Map(),
    activePlan: null,
    activeTab: 'shared-schedule' as const,
    sidebarPane: 'metrics' as const,
    hasLinkedTasks: false,
    wrapUpPlan: null,
    selectedPlanIdsForSharedSchedule: new Set<string>(),
    archiveExpanded: false,
    onToggleArchive: vi.fn(),
    onSelectPlan: vi.fn(),
    onCreatePlan: vi.fn(),
    onDeletePlan: vi.fn(),
    onSavePlan: vi.fn(),
    onSetActiveTab: vi.fn(),
    onSetSidebarPane: vi.fn(),
    onSetSelectedPlanIdsForSharedSchedule: vi.fn(),
    onOpenInsights: vi.fn(),
    onOpenProgress: vi.fn(),
    onOpenWrapUp: vi.fn(),
    onCloseWrapUp: vi.fn(),
    onWrapUpCompleted: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  };
}

describe('PlanningWorkspaceShell sidebar panes', () => {
  it('switches sidebar pane from metrics to issues', () => {
    const props = createProps();
    const { container } = render(<PlanningWorkspaceShell {...props} />);

    fireEvent.click(within(container).getByRole('tab', { name: 'Issues' }));
    expect(props.onSetSidebarPane).toHaveBeenCalledWith('issues');
  });

  it('renders issues empty state when issues pane is active outside schedule context', () => {
    const props = createProps({
      sidebarPane: 'issues',
      activeTab: 'shared-schedule',
      activePlan: null,
    });

    const { container } = render(<PlanningWorkspaceShell {...props} />);
    expect(within(container).getByText('Issues available in Schedule tab')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { createPlan } from '../../../lib/planning/plan-model';
import { PlanningWorkspaceShell } from './PlanningWorkspaceShell';

vi.mock('../hooks/usePlanIdsWithImportedExecutionReturns', () => ({
  usePlanIdsWithImportedExecutionReturns: () => new Set<string>(),
}));

vi.mock('../hooks/useLatestExecutionReturnSummary', () => ({
  useLatestExecutionReturnSummaries: () => new Map<string, never>(),
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

describe('PlanningWorkspaceShell sidebar', () => {
  it('renders plan list in sidebar', () => {
    const props = createProps();
    const { container } = render(<PlanningWorkspaceShell {...props} />);
    expect(within(container).getByText('Plan A')).toBeTruthy();
  });
});

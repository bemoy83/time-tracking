/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldPlanPlanDetail } from './FieldPlanPlanDetail';
import { FIELD_EXECUTION_RETURN_EXPLANATION } from '../../../lib/interop/data-transfer/handoff-copy';

vi.mock('../../../components/CountBadge', () => ({
  CountBadge: ({ count }: { count: number }) => <span>{count}</span>,
}));

vi.mock('../../../components/ProjectColorDot', () => ({
  ProjectColorDot: () => <span>dot</span>,
}));

vi.mock('../../../components/TagFilterPanel', () => ({
  TagFilterPanel: () => <div>tag-filter</div>,
}));

vi.mock('../../../components/useTagFilter', () => ({
  useTagFilter: () => ({
    availableCategories: [],
    hasActiveFilters: false,
    activeTagFilters: new Set<string>(),
    tagSearchQuery: '',
    selectedCategoryId: null,
    displayedTags: [],
    toggleTagFilter: vi.fn(),
    setTagSearchQuery: vi.fn(),
    setSelectedCategoryId: vi.fn(),
    clearTagFilters: vi.fn(),
  }),
}));

vi.mock('../../../components/icons', () => ({
  CheckIcon: () => <span>check</span>,
  ClockIcon: () => <span>clock</span>,
  ExpandChevronIcon: () => <span>expand</span>,
  PlayIcon: () => <span>play</span>,
  TaskListIcon: () => <span>task-list</span>,
  WarningIcon: () => <span>warning</span>,
}));

describe('FieldPlanPlanDetail', () => {
  it('shows handoff timestamps and the explicit execution return CTA', () => {
    render(
      <FieldPlanPlanDetail
        planId="plan-1"
        planDisplayName="Main Event"
        projectColor="#000"
        importedAt="2026-03-22T10:00:00.000Z"
        lastExecutionReturnExportedAt="2026-03-22T18:10:00.000Z"
        progressPercent={50}
        lineItemStatusSummary={{ completed: 1 }}
        lineItems={[]}
        deadlineSummary={{ overdue: 0, atRisk: 0 }}
        statusGroups={{ inProgress: [], blocked: [], pending: [], completed: [], deferred: [] }}
        completedExpanded={false}
        deferredExpanded={false}
        personHours="12.0h"
        unplannedTasks={[]}
        phaseFilter="all"
        onPhaseFilterChange={vi.fn()}
        onToggleCompletedExpanded={vi.fn()}
        onToggleDeferredExpanded={vi.fn()}
        onReleaseEligibleBatch={vi.fn()}
        onReleaseToToday={vi.fn()}
        onOpenActions={vi.fn()}
        onExportExecutionReturn={vi.fn()}
      />,
    );

    expect(screen.getByText('Handoff status')).toBeTruthy();
    expect(screen.getByText(/Imported to device:/)).toBeTruthy();
    expect(screen.getByText(/Last execution return export:/)).toBeTruthy();
    expect(screen.getByText(FIELD_EXECUTION_RETURN_EXPLANATION)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Execution Return' })).toBeTruthy();
  });
});

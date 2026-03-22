/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPlan } from '../../lib/planning/plan-model';
import { ProgressView } from './ProgressView';
import { useExecutionReturnForProgress } from './hooks/useExecutionReturnForProgress';
import { useLatestExecutionReturnSummary } from './hooks/useLatestExecutionReturnSummary';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../lib/interop/data-transfer/handoff-copy';

vi.mock('./hooks/useExecutionReturnForProgress', () => ({
  useExecutionReturnForProgress: vi.fn(),
}));

vi.mock('./hooks/useLatestExecutionReturnSummary', () => ({
  useLatestExecutionReturnSummary: vi.fn(),
}));

vi.mock('../../lib/stores/work-unit-store', () => ({
  useWorkUnitStore: vi.fn(),
}));

vi.mock('./PlanKpiRow', () => ({
  PlanKpiRow: () => <div>kpis</div>,
}));

vi.mock('../../components/WorkUnitImportPreviewPanel', () => ({
  WorkUnitImportPreviewPanel: () => null,
}));

vi.mock('../../components/icons', () => ({
  ChevronLeftIcon: () => <span>back</span>,
  CompleteCircleIcon: () => <span>complete</span>,
  TaskListIcon: () => <span>tasks</span>,
  ClockIcon: () => <span>clock</span>,
  BlockedIcon: () => <span>blocked</span>,
}));

const mockedUseExecutionReturnForProgress = vi.mocked(useExecutionReturnForProgress);
const mockedUseLatestExecutionReturnSummary = vi.mocked(useLatestExecutionReturnSummary);
const mockedUseWorkUnitStore = vi.mocked(useWorkUnitStore);

describe('ProgressView', () => {
  it('renders the persisted latest merge summary in the planning context', () => {
    mockedUseExecutionReturnForProgress.mockReturnValue(null);
    mockedUseLatestExecutionReturnSummary.mockReturnValue({
      executionReturnId: 'return-1',
      planId: 'plan-1',
      planTitle: 'Main Event',
      importedAt: '2026-03-22T18:10:00.000Z',
      mergeSummary: {
        importedAt: '2026-03-22T18:10:00.000Z',
        importedEntryCount: 4,
        skippedDuplicateEntryCount: 1,
        mergedTaskCount: 5,
        lineItemCount: 3,
      },
    });
    mockedUseWorkUnitStore.mockReturnValue({
      definitions: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useWorkUnitStore>);

    render(
      <ProgressView
        plan={{ ...createPlan('Main Event'), id: 'plan-1', status: 'active' }}
        tasks={[]}
        timeEntries={[]}
        onBack={vi.fn()}
        showBackButton={false}
      />,
    );

    expect(screen.getByText(PLANNER_EXECUTION_RETURN_EXPLANATION)).toBeTruthy();
    expect(screen.getByText(CANONICAL_HANDOFF_EXPLANATION)).toBeTruthy();
    expect(screen.getByText('Last merged from field')).toBeTruthy();
    expect(screen.getByText('New entries: 4')).toBeTruthy();
    expect(screen.getByText('Duplicate entries skipped: 1')).toBeTruthy();
    expect(screen.getByText('Tasks merged from payload: 5')).toBeTruthy();
    expect(screen.getByText('Line items reflected: 3')).toBeTruthy();
  });
});

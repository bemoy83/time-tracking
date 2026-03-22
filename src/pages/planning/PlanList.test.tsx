/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createPlan } from '../../lib/planning/plan-model';
import { PlanList } from './PlanList';
import { usePlanIdsWithImportedExecutionReturns } from './hooks/usePlanIdsWithImportedExecutionReturns';
import { useLatestExecutionReturnSummaries } from './hooks/useLatestExecutionReturnSummary';

vi.mock('./hooks/usePlanIdsWithImportedExecutionReturns', () => ({
  usePlanIdsWithImportedExecutionReturns: vi.fn(),
}));

vi.mock('./hooks/useLatestExecutionReturnSummary', () => ({
  useLatestExecutionReturnSummaries: vi.fn(),
}));

vi.mock('./SidebarZone', () => ({
  SidebarZone: ({ label, children }: { label: string; children: ReactNode }) => (
    <section>
      <h2>{label}</h2>
      {children}
    </section>
  ),
}));

vi.mock('../../components/Fab', () => ({
  Fab: () => null,
}));

vi.mock('../../components/StatusBadge', () => ({
  StatusBadge: ({ children }: { children?: ReactNode }) => <span>{children ?? 'badge'}</span>,
}));

vi.mock('./AddToScheduleButton', () => ({
  AddToScheduleButton: () => null,
}));

vi.mock('../../components/icons', () => ({
  ChevronRightIcon: () => <span>chevron</span>,
  TrashIcon: () => <span>trash</span>,
  PlusIcon: () => <span>plus</span>,
  CheckIcon: () => <span>check</span>,
  CompleteCircleIcon: () => <span>complete</span>,
  PencilIcon: () => <span>pencil</span>,
  PlayIcon: () => <span>play</span>,
}));

const mockedUsePlanIdsWithImportedExecutionReturns = vi.mocked(usePlanIdsWithImportedExecutionReturns);
const mockedUseLatestExecutionReturnSummaries = vi.mocked(useLatestExecutionReturnSummaries);

describe('PlanList', () => {
  it('shows the latest merge metadata for in-progress plans', () => {
    const plan = {
      ...createPlan('Main Event'),
      status: 'active' as const,
      handedOffAt: '2026-03-22T08:00:00.000Z',
    };

    mockedUsePlanIdsWithImportedExecutionReturns.mockReturnValue(new Set());
    mockedUseLatestExecutionReturnSummaries.mockReturnValue(new Map([
      ['plan-1', {
        executionReturnId: 'return-1',
        planId: 'plan-1',
        planTitle: 'Main Event',
        importedAt: '2026-03-22T18:10:00.000Z',
        mergeSummary: {
          importedAt: '2026-03-22T18:10:00.000Z',
          importedEntryCount: 1,
          skippedDuplicateEntryCount: 0,
          mergedTaskCount: 2,
          lineItemCount: 3,
        },
      }],
    ]));

    render(
      <PlanList
        plans={[{ ...plan, id: 'plan-1' }]}
        projects={[]}
        tasks={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onOpenWrapUp={vi.fn()}
        onOpenInsights={vi.fn()}
        sidebarMode
      />,
    );

    expect(screen.getByText(/Merged /)).toBeTruthy();
  });
});

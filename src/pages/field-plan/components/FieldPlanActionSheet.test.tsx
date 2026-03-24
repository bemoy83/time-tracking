/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createLineItem, getPhaseFields } from '../../../lib/planning/plan-model';
import type { FieldPlanLineItemSummary } from '../field-plan-model';
import { FieldPlanActionSheet } from './FieldPlanActionSheet';

vi.mock('../../../components/ActionSheet', () => ({
  ActionSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) => (isOpen ? <div aria-label={title}>{children}</div> : null),
}));

vi.mock('../../../components/icons', () => ({
  BlockedIcon: () => <span aria-hidden="true">blocked</span>,
  CheckIcon: () => <span aria-hidden="true">check</span>,
  PencilIcon: () => <span aria-hidden="true">pencil</span>,
  PlayIcon: () => <span aria-hidden="true">play</span>,
}));

function makeSummary(overrides: Partial<FieldPlanLineItemSummary> = {}): FieldPlanLineItemSummary {
  const item = createLineItem('Install', 'Type', 'pcs', 6, 6, 0);
  const phase = 'assembly' as const;
  return {
    item,
    phase,
    phaseFields: getPhaseFields(item, phase),
    tasks: [],
    status: 'pending',
    deadlineStatus: 'unscheduled',
    dueDate: null,
    planId: 'plan-1',
    planTitle: 'Plan',
    planProjectId: 'proj-1',
    planCanExecute: true,
    ...overrides,
  };
}

describe('FieldPlanActionSheet', () => {
  it('shows release action for eligible line items', () => {
    const lineItem = makeSummary();

    render(
      <FieldPlanActionSheet
        formMode={{ kind: 'actions', lineItem }}
        onClose={vi.fn()}
        onSetFormMode={vi.fn()}
        onReleaseToToday={vi.fn()}
        onBlockSubmit={vi.fn()}
        onDeferSubmit={vi.fn()}
        onNoteSubmit={vi.fn()}
        onClearBlock={vi.fn()}
        onReactivateDeferred={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Release to Today' })).toBeTruthy();
  });

  it('hides release action for ineligible line items', () => {
    const lineItem = makeSummary({ planCanExecute: false });

    render(
      <FieldPlanActionSheet
        formMode={{ kind: 'actions', lineItem }}
        onClose={vi.fn()}
        onSetFormMode={vi.fn()}
        onReleaseToToday={vi.fn()}
        onBlockSubmit={vi.fn()}
        onDeferSubmit={vi.fn()}
        onNoteSubmit={vi.fn()}
        onClearBlock={vi.fn()}
        onReactivateDeferred={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Release to Today' })).toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createLineItem } from '../../lib/planning/plan-model';
import { WorkPackageTable } from './WorkPackageTable';

vi.mock('../../lib/stores/work-type-store', () => ({
  useWorkTypeStore: () => ({
    workTypes: [],
  }),
}));

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

function renderTable({
  lineItems = [createLineItem('Install carpet', 'Carpet Tiles', 'm2', 100, 10, 0)],
  onBatchApplySuggestions,
  onDuplicateAll,
  onRemoveAll,
}: {
  lineItems?: ReturnType<typeof createLineItem>[];
  onBatchApplySuggestions?: (
    updates: Array<{ itemId: string; updates: Partial<ReturnType<typeof createLineItem>> }>,
  ) => void;
  onDuplicateAll?: () => void;
  onRemoveAll?: () => void;
} = {}) {
  return render(
    <WorkPackageTable
      lineItems={lineItems}
      suggestionsByLineItemId={new Map()}
      isLocked={false}
      onUpdate={vi.fn()}
      onBatchApplySuggestions={onBatchApplySuggestions}
      onDuplicateAll={onDuplicateAll}
      onDuplicate={vi.fn()}
      onRemoveAll={onRemoveAll}
      onRemove={vi.fn()}
    />,
  );
}

describe('WorkPackageTable batch actions', () => {
  it('renders batch controls only when callbacks are provided', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: 'Duplicate all work packages' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete all work packages' })).toBeNull();
  });

  it('disables duplicate-all and delete-all when there are no line items', () => {
    renderTable({
      lineItems: [],
      onDuplicateAll: vi.fn(),
      onRemoveAll: vi.fn(),
    });

    expect(
      (screen.getByRole('button', { name: 'Duplicate all work packages' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Delete all work packages' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('opens the duplicate dialog and confirms through onDuplicateAll', () => {
    const onDuplicateAll = vi.fn();
    renderTable({ onDuplicateAll });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate all work packages' }));

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Duplicate all work packages?')).toBeTruthy();
    expect(
      screen.getByText(
        'Are you sure you want to duplicate all. This will duplicate 1 work packages',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onDuplicateAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancels the duplicate dialog without calling onDuplicateAll', () => {
    const onDuplicateAll = vi.fn();
    renderTable({ onDuplicateAll });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate all work packages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDuplicateAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens the delete dialog and confirms through onRemoveAll', () => {
    const onRemoveAll = vi.fn();
    renderTable({ onRemoveAll });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all work packages' }));

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Delete all work packages?')).toBeTruthy();
    expect(
      screen.getByText('Are you sure you want to delete all. This will delete 1 work packages'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onRemoveAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancels the delete dialog without calling onRemoveAll', () => {
    const onRemoveAll = vi.fn();
    renderTable({ onRemoveAll });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all work packages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRemoveAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keeps only one confirmation dialog open at a time', () => {
    renderTable({
      onDuplicateAll: vi.fn(),
      onRemoveAll: vi.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate all work packages' }));
    expect(screen.getByText('Duplicate all work packages?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete all work packages' }));

    expect(screen.queryByText('Duplicate all work packages?')).toBeNull();
    expect(screen.getByText('Delete all work packages?')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkTypePicker } from './WorkTypePicker';
import type { WorkType } from '../lib/types';

vi.mock('../lib/stores/work-unit-store', () => ({
  useWorkUnitStore: () => ({}),
}));

const workTypes: WorkType[] = [
  {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    assemblyRate: 12,
    dismantleRate: 8,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'wt-2',
    title: 'Cable Run',
    workUnit: 'm',
    assemblyRate: 30,
    dismantleRate: 12,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

describe('WorkTypePicker', () => {
  it('filters the list and commits the active option with keyboard navigation', () => {
    const handleChange = vi.fn();

    render(
      <WorkTypePicker
        workTypes={workTypes}
        selectedId={null}
        onChange={handleChange}
        placeholder="Select work type..."
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Work Type' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'cable' } });

    expect(screen.getByRole('option', { name: 'Cable Run · m' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Carpet Tiles · m2' })).toBeNull();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith('wt-2');
  });

  it('closes on escape before bubbling to outer listeners', () => {
    const handleChange = vi.fn();
    const documentEscapeSpy = vi.fn();

    document.addEventListener('keydown', documentEscapeSpy);

    render(
      <WorkTypePicker
        workTypes={workTypes}
        selectedId={'wt-1'}
        onChange={handleChange}
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Work Type' });

    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(documentEscapeSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(documentEscapeSpy).toHaveBeenCalledTimes(1);

    document.removeEventListener('keydown', documentEscapeSpy);
  });

  it('restores the committed label after blur', async () => {
    render(
      <div>
        <WorkTypePicker
          workTypes={workTypes}
          selectedId={'wt-1'}
          onChange={vi.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    );

    const input = screen.getByRole('combobox', { name: 'Work Type' }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'cab' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(input.value).toBe('Carpet Tiles · m²');
    });
  });

  it('renders a disabled empty state', () => {
    render(
      <WorkTypePicker
        workTypes={[]}
        selectedId={null}
        onChange={vi.fn()}
        emptyMessage="No work types. Add in Settings."
        disabled
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Work Type' });

    expect(input).toHaveProperty('disabled', true);
    expect(screen.getByText('No work types. Add in Settings.')).toBeTruthy();
  });
});

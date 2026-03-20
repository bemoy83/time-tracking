/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkUnitImportPreviewPanel } from './WorkUnitImportPreviewPanel';

describe('WorkUnitImportPreviewPanel', () => {
  it('renders the shared unit summary and toggle when conflicts exist', () => {
    const onChange = vi.fn();

    render(
      <WorkUnitImportPreviewPanel
        preview={{
          newUnits: [{ id: 'pallets', label: 'Pallets' }],
          labelConflicts: [{ id: 'm2', catalogLabel: 'm²', importLabel: 'Square Metres' }],
        }}
        applyImportedLabels={false}
        onApplyImportedLabelsChange={onChange}
      />,
    );

    expect(screen.getByText('Units: 1 new, 1 label conflict.')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('omits the toggle when there are no label conflicts', () => {
    render(
      <WorkUnitImportPreviewPanel
        preview={{
          newUnits: [{ id: 'pallets', label: 'Pallets' }],
          labelConflicts: [],
        }}
        applyImportedLabels={false}
        onApplyImportedLabelsChange={() => {}}
      />,
    );

    expect(screen.getByText('Units: 1 new, 0 label conflicts.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

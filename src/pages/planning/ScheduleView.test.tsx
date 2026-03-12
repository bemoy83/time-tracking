/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { createPlan } from '../../lib/planning/plan-model';
import { useMediaQuery } from '../../lib/hooks/useMediaQuery';
import { ScheduleView } from './ScheduleView';

vi.mock('../../lib/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

const mockedUseMediaQuery = vi.mocked(useMediaQuery);

afterEach(() => {
  cleanup();
  mockedUseMediaQuery.mockReset();
});

function renderSchedule({
  desktop = false,
  readOnly = false,
}: {
  desktop?: boolean;
  readOnly?: boolean;
}) {
  mockedUseMediaQuery.mockReturnValue(desktop);
  const plan = createPlan('Schedule Test');

  return render(
    <ScheduleView
      plan={plan}
      onSave={vi.fn()}
      onBack={vi.fn()}
      showBackButton={false}
      readOnly={readOnly}
    />,
  );
}

describe('ScheduleView top-band layout', () => {
  it('renders top-band regions and places actions in health controls on desktop', () => {
    const { container } = renderSchedule({ desktop: true, readOnly: false });

    const topBand = container.querySelector('.schedule-view__top-band');
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    const inputsColumn = container.querySelector('.schedule-view__top-band-inputs');

    expect(topBand).toBeTruthy();
    expect(healthColumn).toBeTruthy();
    expect(inputsColumn).toBeTruthy();

    expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Hand off' })).toBeTruthy();
    expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Activate' })).toBeTruthy();
    expect(within(healthColumn as HTMLElement).getByText('Planning Issues Queue')).toBeTruthy();
    expect(within(healthColumn as HTMLElement).getByText('Next Best Action')).toBeTruthy();
  });

  it('shows no-blockers message and activation recommendation for editable draft plans', () => {
    const { container } = renderSchedule({ desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    expect(within(healthColumn as HTMLElement).getByText('No planning blockers detected.')).toBeTruthy();
    expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Activate plan' })).toBeTruthy();
  });

  it('keeps schedule inputs always visible and non-collapsible on desktop', () => {
    const { container } = renderSchedule({ desktop: true });

    const inputsColumn = container.querySelector('.schedule-view__top-band-inputs');
    expect(inputsColumn).toBeTruthy();
    expect((inputsColumn as HTMLElement).querySelector('.schedule-view__block-toggle')).toBeNull();
    expect(within(inputsColumn as HTMLElement).getByText('Build-up')).toBeTruthy();
  });

  it('keeps schedule inputs collapsible on non-desktop', () => {
    const { container } = renderSchedule({ desktop: false });
    const inputsColumn = container.querySelector('.schedule-view__top-band-inputs');
    expect(inputsColumn).toBeTruthy();

    const toggle = within(inputsColumn as HTMLElement).getByRole('button', {
      name: /Schedule Inputs/i,
    });
    expect(toggle).toBeTruthy();
    expect(within(inputsColumn as HTMLElement).getByText('Build-up')).toBeTruthy();

    fireEvent.click(toggle);

    expect(within(inputsColumn as HTMLElement).queryByText('Build-up')).toBeNull();
  });

  it('shows only hand-off action in read-only mode', () => {
    const { container } = renderSchedule({ desktop: true, readOnly: true });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Hand off' })).toBeTruthy();
    expect(
      within(healthColumn as HTMLElement).queryByRole('button', { name: /Activate|Revert to Draft/i }),
    ).toBeNull();
  });
});

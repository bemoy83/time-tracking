/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { createLineItem, createPlan } from '../../lib/planning/plan-model';
import type { Plan } from '../../lib/planning/plan-model';
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

function renderSchedule(plan: Plan, desktop = false) {
  mockedUseMediaQuery.mockReturnValue(desktop);
  return render(
    <ScheduleView
      plan={plan}
      onSave={vi.fn()}
      onBack={vi.fn()}
      showBackButton={false}
      readOnly={false}
    />,
  );
}

describe('ScheduleView', () => {
  it('renders the top-band layout and schedule assistant entry point on desktop', () => {
    const plan = createPlan('Schedule Test');
    const { container } = renderSchedule(plan, true);

    expect(container.querySelector('.schedule-view__top-band')).toBeTruthy();
    expect(container.querySelector('.schedule-view__top-band-health')).toBeTruthy();
    expect(container.querySelector('.schedule-view__top-band-inputs')).toBeTruthy();
    expect(within(container).getByRole('button', { name: /Schedule Assistant/i })).toBeTruthy();
    expect(within(container).getAllByText('Schedule').length).toBeGreaterThan(0);
    expect(within(container).getByText('Hand off')).toBeTruthy();
  });

  it('collapses schedule inputs by default on desktop when dates are set', () => {
    const plan = createPlan('Configured Plan');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-05';
    plan.workCalendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
      { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
    ];

    const { container } = renderSchedule(plan, true);
    const inputsColumn = container.querySelector('.schedule-view__top-band-inputs');
    expect(inputsColumn).toBeTruthy();

    const toggle = (inputsColumn as HTMLElement).querySelector('.schedule-view__block-toggle');
    expect(toggle).toBeTruthy();
    expect((toggle as HTMLElement).getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle as HTMLElement);
    expect(within(inputsColumn as HTMLElement).getByText('Assembly')).toBeTruthy();
  });

  it('keeps schedule inputs collapsible on non-desktop', () => {
    const plan = createPlan('Configured Plan');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-05';
    plan.workCalendar = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 2 },
    ];

    const { container } = renderSchedule(plan, false);
    const inputsColumn = container.querySelector('.schedule-view__top-band-inputs');
    expect(inputsColumn).toBeTruthy();

    const toggle = within(inputsColumn as HTMLElement).getByRole('button', {
      name: /Schedule Inputs/i,
    });
    fireEvent.click(toggle);
    expect(within(inputsColumn as HTMLElement).getByText('Assembly')).toBeTruthy();
  });

  it('clears a scheduled row from the row face clear action', async () => {
    const plan = createPlan('Clear Row');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-02';
    plan.defaultCrewSize = 1;
    plan.workCalendar = [
      {
        date: '2026-03-02',
        isWorkDay: false,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 1,
      },
    ];

    const item = createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyCrewByDate = { '2026-03-02': 1 };
    plan.lineItems = [item];

    const { container } = renderSchedule(plan, true);
    const grid = container.querySelector('.schedule-grid');
    expect(grid).toBeTruthy();

    fireEvent.click(within(grid as HTMLElement).getByRole('button', { name: /Clear schedule for WP-1/i }));

    await waitFor(() => {
      expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-1/i })).toBeNull();
      expect(container.querySelector('.schedule-grid__unscheduled-badge')?.textContent).toContain('1 unscheduled');
    });
  });
});

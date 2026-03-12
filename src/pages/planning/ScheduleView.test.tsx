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

function renderScheduleWithPlan(
  plan: Plan,
  {
    desktop = false,
    readOnly = false,
  }: {
    desktop?: boolean;
    readOnly?: boolean;
  },
) {
  mockedUseMediaQuery.mockReturnValue(desktop);
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
    expect(within(healthColumn as HTMLElement).getByText('Planning Focus')).toBeTruthy();
  });

  it('shows no-blockers message without duplicate activate actions for editable draft plans', () => {
    const { container } = renderSchedule({ desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    expect(within(healthColumn as HTMLElement).getByText('No planning blockers detected.')).toBeTruthy();
    expect(within(healthColumn as HTMLElement).queryByRole('button', { name: 'Activate plan' })).toBeNull();
    expect(within(healthColumn as HTMLElement).getAllByRole('button', { name: 'Activate' })).toHaveLength(1);
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

  it('clears assistant unresolved warning after manual schedule edits', async () => {
    const plan = createPlan('Needs Scheduling');
    plan.buildUpStartDate = '2026-03-02';
    plan.buildUpEndDate = '2026-03-02';
    plan.defaultCrewSize = 0;
    plan.workCalendar = [
      {
        date: '2026-03-02',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 0,
      },
    ];
    plan.lineItems = [createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0)];

    const { container } = renderScheduleWithPlan(plan, { desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Run assistant' }));

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).getByText(/Assistant still has 1 unresolved item/i)).toBeTruthy();
    });

    const firstDateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(firstDateInput).toBeTruthy();
    fireEvent.change(firstDateInput as HTMLInputElement, { target: { value: '2026-03-03' } });

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).queryByText(/Assistant still has 1 unresolved item/i)).toBeNull();
    });
  });

  it('marks assistant findings stale after crew edits instead of showing ready state', async () => {
    const plan = createPlan('Crew Edit Stale');
    plan.buildUpStartDate = '2026-03-02';
    plan.buildUpEndDate = '2026-03-02';
    plan.defaultCrewSize = 1;
    plan.workCalendar = [
      {
        date: '2026-03-02',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 1,
      },
    ];

    const scheduled = createLineItem('Scheduled', 'Scheduled', 'm2', 8, 1, 0);
    scheduled.buildUpScheduledStart = '2026-03-02';
    scheduled.buildUpScheduledEnd = '2026-03-02';
    scheduled.buildUpCrewByDate = { '2026-03-02': 1 };

    const unresolved = createLineItem('Unresolved', 'Unresolved', 'm2', 16, 1, 0);
    plan.lineItems = [scheduled, unresolved];

    const { container } = renderScheduleWithPlan(plan, { desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Run assistant' }));

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).getByText(/Assistant still has 1 unresolved item/i)).toBeTruthy();
    });

    fireEvent.click(
      within(container).getByRole('button', { name: /Decrease crew for Scheduled on 2026-03-02/i }),
    );

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).queryByText(/Assistant still has 1 unresolved item/i)).toBeNull();
      expect(
        within(healthColumn as HTMLElement).getByText(/^Assistant findings are stale after manual schedule edits$/i),
      ).toBeTruthy();
      expect(within(healthColumn as HTMLElement).getByText(/Re-run assistant before activation/i)).toBeTruthy();
      expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Re-run assistant' })).toBeTruthy();
      expect(within(healthColumn as HTMLElement).queryByText(/No blockers detected/i)).toBeNull();
    });

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Re-run assistant' }));

    await waitFor(() => {
      expect(
        within(healthColumn as HTMLElement).queryByText(/^Assistant findings are stale after manual schedule edits$/i),
      ).toBeNull();
      expect(within(healthColumn as HTMLElement).getByText(/Assistant still has [0-9]+ unresolved item/i)).toBeTruthy();
      expect(within(healthColumn as HTMLElement).queryByText(/No blockers detected/i)).toBeNull();
    });
  });

  it('review assistant issues highlights unresolved rows and supports navigation', async () => {
    const plan = createPlan('Multiple Unresolved');
    plan.buildUpStartDate = '2026-03-02';
    plan.buildUpEndDate = '2026-03-02';
    plan.defaultCrewSize = 0;
    plan.workCalendar = [
      {
        date: '2026-03-02',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 0,
      },
    ];
    plan.lineItems = [
      createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0),
      createLineItem('WP-2', 'WP-2', 'm2', 16, 1, 0),
    ];

    const { container } = renderScheduleWithPlan(plan, { desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Run assistant' }));

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Review assistant issues' })).toBeTruthy();
    });

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Review assistant issues' }));

    await waitFor(() => {
      const reviewBar = container.querySelector('.schedule-view__assistant-review');
      expect(reviewBar).toBeTruthy();
      expect(within(reviewBar as HTMLElement).getByText(/Issue 1 of 2/i)).toBeTruthy();
      expect(container.querySelector('.schedule-grid__row--assistant-active')).toBeTruthy();
      expect(container.querySelectorAll('.schedule-grid__row--assistant-unresolved').length).toBe(2);
    });

    const reviewBar = container.querySelector('.schedule-view__assistant-review');
    fireEvent.click(within(reviewBar as HTMLElement).getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(within(reviewBar as HTMLElement).getByText(/Issue 2 of 2/i)).toBeTruthy();
    });
  });

  it('clears a scheduled row from the row face clear action', async () => {
    const plan = createPlan('Clear Row');
    plan.buildUpStartDate = '2026-03-02';
    plan.buildUpEndDate = '2026-03-02';
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
    item.buildUpScheduledStart = '2026-03-02';
    item.buildUpScheduledEnd = '2026-03-02';
    item.buildUpCrewByDate = { '2026-03-02': 1 };
    plan.lineItems = [item];

    const { container } = renderScheduleWithPlan(plan, { desktop: true, readOnly: false });
    const grid = container.querySelector('.schedule-grid');
    expect(grid).toBeTruthy();

    fireEvent.click(within(grid as HTMLElement).getByRole('button', { name: /Clear schedule for WP-1/i }));

    await waitFor(() => {
      expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-1/i })).toBeNull();
      expect(container.querySelector('.schedule-grid__unscheduled-badge')?.textContent).toContain('1 unscheduled');
    });
  });

  it('clears all scheduled rows from the health card action', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const plan = createPlan('Clear All');
      plan.buildUpStartDate = '2026-03-02';
      plan.buildUpEndDate = '2026-03-02';
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

      const a = createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0);
      a.buildUpScheduledStart = '2026-03-02';
      a.buildUpScheduledEnd = '2026-03-02';
      a.buildUpCrewByDate = { '2026-03-02': 1 };
      const b = createLineItem('WP-2', 'WP-2', 'm2', 8, 1, 0);
      b.buildUpScheduledStart = '2026-03-02';
      b.buildUpScheduledEnd = '2026-03-02';
      b.buildUpCrewByDate = { '2026-03-02': 1 };
      plan.lineItems = [a, b];

      const { container } = renderScheduleWithPlan(plan, { desktop: true, readOnly: false });
      const healthColumn = container.querySelector('.schedule-view__top-band-health');
      const grid = container.querySelector('.schedule-grid');
      expect(healthColumn).toBeTruthy();
      expect(grid).toBeTruthy();

      fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Clear all schedules (2)' }));

      await waitFor(() => {
        expect(container.querySelector('.schedule-grid__unscheduled-badge')?.textContent).toContain('2 unscheduled');
        expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-1/i })).toBeNull();
        expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-2/i })).toBeNull();
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });
});

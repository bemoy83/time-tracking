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
  vi.useRealTimers();
  mockedUseMediaQuery.mockReset();
});

function renderSchedule(plan: Plan, desktop = false) {
  mockedUseMediaQuery.mockReturnValue(desktop);
  const onSave = vi.fn();
  return render(
    <ScheduleView
      plan={plan}
      onSave={onSave}
      onBack={vi.fn()}
      showBackButton={false}
      readOnly={false}
    />
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
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 1,
      },
    ];

    const item = createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const { container } = renderSchedule(plan, true);
    const grid = container.querySelector('.schedule-grid');
    expect(grid).toBeTruthy();

    fireEvent.click(within(grid as HTMLElement).getByRole('button', { name: /Clear schedule for WP-1/i }));

    await waitFor(() => {
      expect(container.textContent).toContain('Unscheduled hrs');
      expect(container.textContent).toContain('8');
      expect(container.querySelectorAll('.schedule-grid__cell--assigned')).toHaveLength(0);
    });
  });

  it('toggles off the last assigned cell completely', async () => {
    const plan = createPlan('Toggle Off');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-02';
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

    const item = createLineItem('WP-3', 'WP-3', 'm2', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const { container } = renderSchedule(plan, true);
    const assignedCell = container.querySelector('.schedule-grid__cell--assigned');
    expect(assignedCell).toBeTruthy();

    fireEvent.click(assignedCell as HTMLElement);

    await waitFor(() => {
      expect(container.querySelectorAll('.schedule-grid__cell--assigned')).toHaveLength(0);
    });
  });

  it('clears all schedules from the assistant action', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const plan = createPlan('Clear All');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-03';
    plan.defaultCrewSize = 1;
    plan.workCalendar = [
      {
        date: '2026-03-02',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 1,
      },
      {
        date: '2026-03-03',
        isWorkDay: true,
        accessStart: '08:00',
        accessEnd: '16:00',
        crewSize: 1,
      },
    ];

    const itemA = createLineItem('A', 'A', 'm2', 8, 1, 0);
    itemA.assemblyScheduledStart = '2026-03-02';
    itemA.assemblyScheduledEnd = '2026-03-02';
    itemA.assemblyPersonHoursByDate = { '2026-03-02': 8 };

    const itemB = createLineItem('B', 'B', 'm2', 8, 1, 0);
    itemB.assemblyScheduledStart = '2026-03-03';
    itemB.assemblyScheduledEnd = '2026-03-03';
    itemB.assemblyPersonHoursByDate = { '2026-03-03': 8 };

    plan.lineItems = [itemA, itemB];

    const { container } = renderSchedule(plan, true);
    fireEvent.click(within(container).getByRole('button', { name: /Schedule Assistant/i }));
    fireEvent.click(await within(container).findByRole('button', { name: /Clear all schedules/i }));

    await waitFor(() => {
      expect(container.querySelectorAll('.schedule-grid__cell--assigned')).toHaveLength(0);
    });

    confirmSpy.mockRestore();
  });

  it('edits planned hours inline from an assigned cell', async () => {
    const plan = createPlan('Edit Hours');
    plan.assemblyStartDate = '2026-03-02';
    plan.assemblyEndDate = '2026-03-02';
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

    const item = createLineItem('WP-2', 'WP-2', 'm2', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const onSave = vi.fn();
    mockedUseMediaQuery.mockReturnValue(true);
    const { container } = render(
      <ScheduleView
        plan={plan}
        onSave={onSave}
        onBack={vi.fn()}
        showBackButton={false}
        readOnly={false}
      />,
    );

    fireEvent.click(within(container).getByRole('button', { name: /Edit planned hours for WP-2 on 2026-03-02/i }));
    const input = within(container).getByRole('textbox', { name: /Edit planned hours for WP-2 on 2026-03-02/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(container.textContent).toContain('5.5h / 8.0h');
    });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    }, { timeout: 1200 });

    const savedPlan = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as Plan;
    expect(savedPlan.lineItems[0].assemblyPersonHoursByDate).toEqual({ '2026-03-02': 5.5 });
  });
});

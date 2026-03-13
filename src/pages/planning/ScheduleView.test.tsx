/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
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
  isWorkspaceMode = false,
  onIssuePanelChange,
}: {
  desktop?: boolean;
  readOnly?: boolean;
  isWorkspaceMode?: boolean;
  onIssuePanelChange?: (payload: unknown) => void;
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
      isWorkspaceMode={isWorkspaceMode}
      onIssuePanelChange={onIssuePanelChange}
    />,
  );
}

function renderScheduleWithPlan(
  plan: Plan,
  {
    desktop = false,
    readOnly = false,
    isWorkspaceMode = false,
    onIssuePanelChange,
  }: {
    desktop?: boolean;
    readOnly?: boolean;
    isWorkspaceMode?: boolean;
    onIssuePanelChange?: (payload: unknown) => void;
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
      isWorkspaceMode={isWorkspaceMode}
      onIssuePanelChange={onIssuePanelChange}
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
    expect(within(healthColumn as HTMLElement).getByText('Things to check')).toBeTruthy();
    expect(within(healthColumn as HTMLElement).getByText('What to do next')).toBeTruthy();
  });

  it('shows no-blockers message without duplicate activate actions for editable draft plans', () => {
    const { container } = renderSchedule({ desktop: true, readOnly: false });
    const healthColumn = container.querySelector('.schedule-view__top-band-health');
    expect(healthColumn).toBeTruthy();

    expect(within(healthColumn as HTMLElement).getAllByText('Nothing blocking — you can activate when ready.')).toHaveLength(2);
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
      expect(within(healthColumn as HTMLElement).getByText(/1 item still needs review/i)).toBeTruthy();
    });

    const firstDateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(firstDateInput).toBeTruthy();
    fireEvent.change(firstDateInput as HTMLInputElement, { target: { value: '2026-03-03' } });

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).queryByText(/1 item still needs review/i)).toBeNull();
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
      expect(within(healthColumn as HTMLElement).getByText(/1 item still needs review/i)).toBeTruthy();
    });

    fireEvent.click(
      within(container).getByRole('button', { name: /Decrease crew for Scheduled on 2026-03-02/i }),
    );

    await waitFor(() => {
      expect(within(healthColumn as HTMLElement).queryByText(/1 item still needs review/i)).toBeNull();
      expect(
        within(healthColumn as HTMLElement).getByText(/^Schedule changed — re-run to re-check$/i),
      ).toBeTruthy();
      expect(within(healthColumn as HTMLElement).getByText(/Re-run the assistant to re-check before activating/i)).toBeTruthy();
      expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Re-run assistant' })).toBeTruthy();
      expect(within(healthColumn as HTMLElement).queryByText(/Nothing blocking/i)).toBeNull();
    });

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Re-run assistant' }));

    await waitFor(() => {
      expect(
        within(healthColumn as HTMLElement).queryByText(/^Schedule changed — re-run to re-check$/i),
      ).toBeNull();
      expect(within(healthColumn as HTMLElement).getByText(/[0-9]+ item(s)? still need(s)? review/i)).toBeTruthy();
      expect(within(healthColumn as HTMLElement).queryByText(/Nothing blocking/i)).toBeNull();
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
      expect(within(healthColumn as HTMLElement).getByRole('button', { name: 'Review issues' })).toBeTruthy();
    });

    fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Review issues' }));

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

      fireEvent.click(within(healthColumn as HTMLElement).getByRole('button', { name: 'Clear all (2)' }));

      await waitFor(() => {
        expect(container.querySelector('.schedule-grid__unscheduled-badge')?.textContent).toContain('2 unscheduled');
        expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-1/i })).toBeNull();
        expect(within(grid as HTMLElement).queryByRole('button', { name: /Clear schedule for WP-2/i })).toBeNull();
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('publishes issue panel payload and allows sidebar issue selection in workspace mode', async () => {
    const plan = createPlan('Issue Payload');
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

    let latestPayload: any = null;
    const onIssuePanelChange = vi.fn((payload) => {
      latestPayload = payload;
    });

    const { container, unmount } = renderScheduleWithPlan(
      plan,
      {
        desktop: true,
        readOnly: false,
        isWorkspaceMode: true,
        onIssuePanelChange,
      },
    );

    await waitFor(() => {
      expect(latestPayload?.state?.planId).toBe(plan.id);
      expect(latestPayload?.state?.canRunAssistant).toBe(true);
    });

    await act(async () => {
      await latestPayload.actions.runAssistant();
    });

    await waitFor(() => {
      expect(latestPayload?.state?.unresolvedCount).toBeGreaterThan(0);
    });

    const unresolvedIssue = latestPayload.state.issues.find((issue: any) => issue.kind === 'assistant-unresolved');
    const unscheduledIssue = latestPayload.state.issues.find((issue: any) => issue.kind === 'unscheduled');
    expect(unresolvedIssue?.issueKey).toBeTruthy();
    expect(unresolvedIssue?.scope).toBe('item');
    expect(unresolvedIssue?.category).toBe('adjustment');
    expect(typeof unresolvedIssue?.detail).toBe('string');
    expect(unresolvedIssue?.detail.length).toBeGreaterThan(0);
    expect(Array.isArray(unresolvedIssue?.facts)).toBe(true);
    expect(unscheduledIssue?.scope).toBe('plan');
    expect(unscheduledIssue?.category).toBe('adjustment');
    expect(unscheduledIssue?.detail).toMatch(/no scheduled span/i);

    act(() => {
      latestPayload.actions.selectIssue(unresolvedIssue.issueKey);
    });

    await waitFor(() => {
      expect(container.querySelector('.schedule-grid__row--assistant-active')).toBeTruthy();
    });

    unmount();
    await waitFor(() => {
      expect(onIssuePanelChange).toHaveBeenLastCalledWith(null);
    });
  });

  it('keeps plan overview block and review strip unchanged in workspace mode', async () => {
    const plan = createPlan('Workspace De-dupe');
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

    let latestPayload: any = null;
    const onIssuePanelChange = vi.fn((payload) => {
      latestPayload = payload;
    });

    const { container } = renderScheduleWithPlan(
      plan,
      {
        desktop: true,
        readOnly: false,
        isWorkspaceMode: true,
        onIssuePanelChange,
      },
    );

    expect(within(container).getByText('Things to check')).toBeTruthy();
    expect(within(container).getByText('What to do next')).toBeTruthy();

    await act(async () => {
      await latestPayload.actions.runAssistant();
    });

    await waitFor(() => {
      expect(container.querySelector('.schedule-view__assistant-review')).toBeTruthy();
      expect(within(container).getByText('Assistant run details')).toBeTruthy();
    });
  });

  it('publishes capacity help facts for blocking plan-level issues', async () => {
    const plan = createPlan('Capacity Payload');
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

    const item = createLineItem('WP-1', 'WP-1', 'm2', 8, 1, 0);
    item.buildUpScheduledStart = '2026-03-02';
    item.buildUpScheduledEnd = '2026-03-02';
    item.buildUpCrewByDate = { '2026-03-02': 2 };
    plan.lineItems = [item];

    let latestPayload: any = null;
    const onIssuePanelChange = vi.fn((payload) => {
      latestPayload = payload;
    });

    renderScheduleWithPlan(plan, {
      desktop: true,
      readOnly: false,
      isWorkspaceMode: true,
      onIssuePanelChange,
    });

    await waitFor(() => {
      const capacityIssue = latestPayload?.state?.issues?.find((issue: any) => issue.id === 'worker-capacity');
      expect(capacityIssue).toBeTruthy();
      expect(capacityIssue.scope).toBe('plan');
      expect(capacityIssue.category).toBe('blocking');
      expect(capacityIssue.detail).toMatch(/assigned crew/i);
      expect(Array.isArray(capacityIssue.facts)).toBe(true);
      expect(capacityIssue.facts.length).toBeGreaterThan(0);
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { SidebarIssuesPanel } from './SidebarIssuesPanel';
import type { ScheduleIssuePanelPayload } from './schedule-issue-panel-types';

function createPayload(overrides: Partial<ScheduleIssuePanelPayload['state']> = {}): ScheduleIssuePanelPayload {
  return {
    state: {
      planId: 'plan-1',
      isStale: false,
      unresolvedCount: 1,
      assistantStatus: 'needs-review',
      assistantSummary: 'The schedule still has blocking issues. Start with the shared bottleneck below before editing rows one by one.',
      assistantBestNextMove: {
        title: 'Add 2 crew on Tue Mar 12.',
        rationale: 'Assigned work exceeds available day capacity.',
        impact: 'Solving the constrained day first is likely to unblock multiple assignments at once.',
      },
      assistantInsights: [
        'Shared bottlenecks should be cleared before row-by-row adjustments.',
        'Most unresolved build-up rows are short on capacity, not dates.',
      ],
      issues: [
        {
          id: 'capacity-1',
          kind: 'capacity',
          severity: 'critical',
          label: '1 day has too much work for available crew',
          scope: 'plan',
          category: 'blocking',
          detail: 'Assigned work exceeds available day capacity.',
          facts: ['Add 2 crew on Tue Mar 12.'],
        },
        {
          id: 'assistant-1',
          kind: 'assistant-unresolved',
          severity: 'warning',
          label: 'WP-1 · build-up · Missing required hours',
          scope: 'item',
          category: 'adjustment',
          detail: '8.0h missing of 16.0h required for build-up.',
          facts: ['8.0h currently scheduled of 16.0h needed.'],
          issueKey: 'line-1:build-up',
          lineItemId: 'line-1',
          phase: 'build-up',
          unresolvedReason: 'missing_required_hours',
          requiredPH: 16,
          assignedPH: 8,
        },
      ],
      activeIssueKey: 'line-1:build-up',
      canRunAssistant: true,
      canClearAll: true,
      ...overrides,
    },
    actions: {
      selectIssue: vi.fn(),
      focusNext: vi.fn(),
      focusPrev: vi.fn(),
      runAssistant: vi.fn(async () => {}),
      clearAllSchedules: vi.fn(),
      openCalendar: vi.fn(),
    },
  };
}

describe('SidebarIssuesPanel', () => {
  it('renders planner assistant summary, best next move, and grouped evidence', () => {
    const payload = createPayload();
    const { container } = render(
      <SidebarIssuesPanel payload={payload} isScheduleContext />,
    );

    expect(within(container).getByText('Scheduling help')).toBeTruthy();
    expect(within(container).getAllByText('Needs review').length).toBe(2);
    expect(within(container).getByText(/shared bottleneck below/i)).toBeTruthy();
    expect(within(container).getByText('Best next move')).toBeTruthy();
    expect(within(container).getAllByText('Add 2 crew on Tue Mar 12.').length).toBeGreaterThan(0);
    expect(within(container).getByText('What I\'m seeing')).toBeTruthy();
    expect(within(container).getByText('Shared bottlenecks should be cleared before row-by-row adjustments.')).toBeTruthy();
    expect(within(container).getByText('Blocking activation')).toBeTruthy();
    expect(within(container).getByText('Needs schedule adjustment')).toBeTruthy();
    expect(within(container).getByText('1 day has too much work for available crew')).toBeTruthy();
    expect(within(container).getByText('WP-1 · build-up · Missing required hours')).toBeTruthy();
    expect(within(container).getAllByText('What\'s happening').length).toBeGreaterThan(0);
    expect(within(container).getAllByText('Why it matters').length).toBeGreaterThan(0);
    expect(within(container).getAllByText('What I\'d try').length).toBeGreaterThan(0);
    expect(within(container).getAllByText('Assigned work exceeds available day capacity.').length).toBeGreaterThan(0);
    expect(within(container).getByText('8.0h missing of 16.0h required for build-up.')).toBeTruthy();
    expect(within(container).getAllByText('Add 2 crew on Tue Mar 12.').length).toBeGreaterThan(0);
    expect(within(container).getByText('8.0h currently scheduled of 16.0h needed.')).toBeTruthy();
    expect(within(container).getByText('8.0h / 16.0h')).toBeTruthy();
    expect(within(container).getByText('Local fix: add crew on the already scheduled days to recover the missing 8.0h.')).toBeTruthy();
  });

  it('shows ready summary with no issues and omits best next move', () => {
    const payload = createPayload({
      unresolvedCount: 0,
      assistantStatus: 'ready',
      assistantSummary: 'No scheduling blockers are currently detected.',
      assistantBestNextMove: null,
      assistantInsights: [],
      issues: [],
    });

    const { container } = render(<SidebarIssuesPanel payload={payload} isScheduleContext />);
    expect(within(container).getAllByText('Ready').length).toBe(2);
    expect(within(container).getByText(/No scheduling blockers are currently detected/i)).toBeTruthy();
    expect(within(container).getByText('No open issues')).toBeTruthy();
    expect(within(container).queryByText('Best next move')).toBeNull();
  });

  it('shows assistant stale summary and hides unresolved item cards while stale', () => {
    const payload = createPayload({
      isStale: true,
      assistantStatus: 'stale',
      assistantSummary: 'The schedule changed after the last assistant run, so detailed unresolved guidance may no longer match the current grid.',
      assistantBestNextMove: {
        title: 'Re-run the assistant',
        rationale: 'Refresh the findings before trusting unresolved issue guidance from the previous run.',
        impact: 'A fresh pass will confirm which issues still need attention.',
      },
      assistantInsights: [],
      issues: [
        {
          id: 'assistant-stale',
          kind: 'assistant-stale',
          severity: 'warning',
          label: 'Schedule changed — re-run to re-check',
          scope: 'plan',
          category: 'blocking',
          detail: 'Assistant findings are out of date.',
        },
        {
          id: 'assistant-1',
          kind: 'assistant-unresolved',
          severity: 'warning',
          label: 'WP-1 · build-up · Missing required hours',
          scope: 'item',
          category: 'adjustment',
          detail: '8.0h missing of 16.0h required for build-up.',
          issueKey: 'line-1:build-up',
        },
      ],
      unresolvedCount: 0,
    });

    const { container } = render(<SidebarIssuesPanel payload={payload} isScheduleContext />);
    expect(within(container).getAllByText('Assistant stale').length).toBe(2);
    expect(within(container).getByText('Best next move')).toBeTruthy();
    expect(within(container).getByText('Re-run the assistant')).toBeTruthy();
    expect(within(container).getByText('Schedule changed after assistant run. Re-run assistant to refresh unresolved findings.')).toBeTruthy();
    expect(within(container).queryByText('WP-1 · build-up · Missing required hours')).toBeNull();
  });

  it('shows empty-context state outside schedule tab', () => {
    const { container } = render(<SidebarIssuesPanel payload={null} isScheduleContext={false} />);
    expect(within(container).getByText('Issues available in Schedule tab')).toBeTruthy();
  });
});

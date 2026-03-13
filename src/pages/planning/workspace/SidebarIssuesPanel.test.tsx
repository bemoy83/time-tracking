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
      issues: [
        {
          id: 'capacity-1',
          kind: 'capacity',
          severity: 'critical',
          label: '1 day has too much work for available crew',
        },
        {
          id: 'assistant-1',
          kind: 'assistant-unresolved',
          severity: 'warning',
          label: 'WP-1 · build-up · Missing required hours',
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
  it('renders grouped issues and active issue metrics', () => {
    const payload = createPayload();
    const { container } = render(
      <SidebarIssuesPanel payload={payload} isScheduleContext />,
    );

    expect(within(container).getByText('Critical blockers')).toBeTruthy();
    expect(within(container).getByText('Warnings')).toBeTruthy();
    expect(within(container).getByText('1 day has too much work for available crew')).toBeTruthy();
    expect(within(container).getByText('WP-1 · build-up · Missing required hours')).toBeTruthy();
    expect(within(container).getByText('8.0h / 16.0h')).toBeTruthy();
    expect(within(container).getByText('Consider increasing crew on the scheduled days for this phase.')).toBeTruthy();
  });

  it('renders read-only suggestions without action buttons', () => {
    const payload = createPayload({
      canRunAssistant: false,
    });

    const { container } = render(<SidebarIssuesPanel payload={payload} isScheduleContext />);
    expect(within(container).queryByRole('button', { name: /Run assistant/i })).toBeNull();
    expect(within(container).queryByRole('button', { name: 'Prev' })).toBeNull();
    expect(within(container).getByText('Consider adjusting crew size or access hours in Work Calendar.')).toBeTruthy();
  });

  it('shows stale guidance copy when assistant findings are outdated', () => {
    const payload = createPayload({
      isStale: true,
      issues: [
        {
          id: 'assistant-stale',
          kind: 'assistant-stale',
          severity: 'warning',
          label: 'Schedule changed — re-run to re-check',
        },
      ],
      unresolvedCount: 0,
    });

    const { container } = render(<SidebarIssuesPanel payload={payload} isScheduleContext />);
    expect(within(container).getByText('Schedule changed after assistant run. Re-run assistant to refresh unresolved findings.')).toBeTruthy();
    expect(within(container).getByText('Re-run assistant to refresh findings')).toBeTruthy();
  });

  it('shows empty-context state outside schedule tab', () => {
    const { container } = render(<SidebarIssuesPanel payload={null} isScheduleContext={false} />);
    expect(within(container).getByText('Issues available in Schedule tab')).toBeTruthy();
  });
});

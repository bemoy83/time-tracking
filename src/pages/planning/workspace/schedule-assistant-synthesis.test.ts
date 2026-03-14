import { describe, expect, it } from 'vitest';
import { synthesizeScheduleAssistant } from './schedule-assistant-synthesis';
import type { ScheduleIssueItem } from './schedule-issue-panel-types';

function createIssue(overrides: Partial<ScheduleIssueItem> = {}): ScheduleIssueItem {
  return {
    id: 'issue-1',
    kind: 'assistant-unresolved',
    severity: 'warning',
    label: 'WP-1 · build-up · Missing required hours',
    category: 'adjustment',
    scope: 'item',
    assistantPriority: 50,
    unresolvedReason: 'missing_required_hours',
    phase: 'build-up',
    ...overrides,
  };
}

describe('synthesizeScheduleAssistant', () => {
  it('prioritizes stale guidance over detailed issue review', () => {
    const result = synthesizeScheduleAssistant({
      isStale: true,
      unresolvedCount: 2,
      canRunAssistant: true,
      issues: [
        createIssue(),
      ],
    });

    expect(result.assistantStatus).toBe('stale');
    expect(result.assistantBestNextMove?.title).toBe('Re-run the assistant');
    expect(result.assistantInsights).toHaveLength(0);
  });

  it('picks a shared capacity bottleneck as the best next move', () => {
    const result = synthesizeScheduleAssistant({
      isStale: false,
      unresolvedCount: 0,
      canRunAssistant: true,
      issues: [
        createIssue({
          id: 'capacity-1',
          kind: 'capacity',
          severity: 'critical',
          label: '1 day has too much work for available crew',
          category: 'blocking',
          scope: 'plan',
          assistantPriority: 10,
          facts: ['Add 2 crew on Tue Mar 12.'],
          detail: 'Assigned work exceeds available day capacity.',
          impact: 'Solving the constrained day first is likely to unblock multiple assignments at once.',
        }),
        createIssue(),
      ],
    });

    expect(result.assistantStatus).toBe('needs-review');
    expect(result.assistantBestNextMove?.title).toBe('Add 2 crew on Tue Mar 12.');
    expect(result.assistantBestNextMove?.impact).toContain('unblock multiple assignments');
  });

  it('creates a shared insight for repeated no-work-days issues', () => {
    const result = synthesizeScheduleAssistant({
      isStale: false,
      unresolvedCount: 2,
      canRunAssistant: true,
      issues: [
        createIssue({
          id: 'issue-a',
          unresolvedReason: 'no_work_days',
          assistantPriority: 40,
          sharedConstraintKey: 'reason:no_work_days:build-up',
        }),
        createIssue({
          id: 'issue-b',
          unresolvedReason: 'no_work_days',
          assistantPriority: 40,
          sharedConstraintKey: 'reason:no_work_days:build-up',
        }),
      ],
    });

    expect(result.assistantInsights).toContain(
      'Several build-up rows fail because their current windows contain no work days.',
    );
  });

  it('creates a shared insight for repeated missing-hours issues', () => {
    const result = synthesizeScheduleAssistant({
      isStale: false,
      unresolvedCount: 2,
      canRunAssistant: true,
      issues: [
        createIssue({
          id: 'issue-a',
          sharedConstraintKey: 'reason:missing_required_hours:build-up',
        }),
        createIssue({
          id: 'issue-b',
          sharedConstraintKey: 'reason:missing_required_hours:build-up',
        }),
      ],
    });

    expect(result.assistantInsights).toContain(
      'Most unresolved build-up rows are short on capacity, not dates.',
    );
  });
});

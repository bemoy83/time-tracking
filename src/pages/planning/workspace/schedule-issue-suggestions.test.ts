import { describe, expect, it } from 'vitest';
import { buildIssueSuggestions } from './schedule-issue-suggestions';
import type { ScheduleIssueItem, ScheduleIssuePanelState } from './schedule-issue-panel-types';

function createState(overrides: Partial<ScheduleIssuePanelState> = {}): ScheduleIssuePanelState {
  return {
    planId: 'plan-1',
    isStale: false,
    unresolvedCount: 1,
    issues: [],
    activeIssueKey: null,
    canRunAssistant: true,
    canClearAll: true,
    ...overrides,
  };
}

function createItem(overrides: Partial<ScheduleIssueItem>): ScheduleIssueItem {
  return {
    id: 'issue-1',
    kind: 'assistant-unresolved',
    severity: 'warning',
    label: 'WP-1 · build-up · Missing required hours',
    scope: 'item',
    category: 'adjustment',
    issueKey: 'line-1:build-up',
    ...overrides,
  };
}

describe('buildIssueSuggestions', () => {
  it('builds explicit missing-hours guidance', () => {
    const suggestions = buildIssueSuggestions(createItem({
      unresolvedReason: 'missing_required_hours',
      requiredPH: 16,
      assignedPH: 8,
    }), createState());

    expect(suggestions[0]?.label).toContain('Local fix');
    expect(suggestions[0]?.label).toContain('missing 8.0h');
    expect(suggestions.some((item) => item.label.includes('Alternative: extend the phase across more work days'))).toBe(true);
  });

  it('builds no-work-days guidance', () => {
    const suggestions = buildIssueSuggestions(createItem({
      unresolvedReason: 'no_work_days',
    }), createState());

    expect(suggestions.some((item) => item.label.includes('System fix: enable at least one work day'))).toBe(true);
    expect(suggestions.some((item) => item.label.includes('Local fix: shift the phase dates'))).toBe(true);
  });

  it('builds no-capacity-window guidance', () => {
    const suggestions = buildIssueSuggestions(createItem({
      unresolvedReason: 'no_capacity_window',
    }), createState());

    expect(suggestions.some((item) => item.label.includes('Local fix: widen or shift the phase window'))).toBe(true);
    expect(suggestions.some((item) => item.label.includes('System fix: free crew on the constrained days'))).toBe(true);
  });

  it('builds day-level capacity guidance', () => {
    const suggestions = buildIssueSuggestions(createItem({
      kind: 'capacity',
      severity: 'critical',
      label: '2 days are overloaded',
      scope: 'plan',
      category: 'blocking',
    }), createState());

    expect(suggestions.some((item) => item.label.includes('System fix: add crew or extend access hours'))).toBe(true);
    expect(suggestions.some((item) => item.label.includes('Fallback: if crew cannot increase'))).toBe(true);
  });
});

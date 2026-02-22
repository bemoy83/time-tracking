import { describe, expect, it } from 'vitest';
import type { IssueQueueItem } from '../../lib/remediation/issue-queue';
import { getNeedsActionCounters, summarizeBulkFixResult } from './SettingsRemediationView';

function makeNeedsItem(overrides: Partial<IssueQueueItem> = {}): IssueQueueItem {
  return {
    category: 'needs_measurable_owner',
    taskId: 't1',
    entryId: 'e1',
    taskTitle: 'Task 1',
    description: 'No measurable owner',
    suggestedTargetId: null,
    suggestedTargetTitle: null,
    recommendedWorkTypeId: null,
    suggestionSource: null,
    personHours: 1.5,
    ...overrides,
  };
}

describe('getNeedsActionCounters', () => {
  it('counts suggested vs manual-required items', () => {
    const items = [
      makeNeedsItem({ taskId: 't1', suggestedTargetId: 'owner-1', recommendedWorkTypeId: 'wt-1', suggestionSource: 'nearest' }),
      makeNeedsItem({ taskId: 't2', entryId: 'e2' }),
      makeNeedsItem({ taskId: 't3', entryId: 'e3', suggestedTargetId: 'owner-2', recommendedWorkTypeId: 'wt-2', suggestionSource: 'engine' }),
    ];

    const counters = getNeedsActionCounters(items);

    expect(counters.total).toBe(3);
    expect(counters.withSuggestion).toBe(2);
    expect(counters.manualRequired).toBe(1);
  });
});

describe('summarizeBulkFixResult', () => {
  it('returns no-eligible summary', () => {
    expect(
      summarizeBulkFixResult('Apply', { attempted: 0, succeeded: 0, failed: [] }),
    ).toContain('no eligible entries with recommended WorkType');
  });

  it('returns success summary', () => {
    expect(
      summarizeBulkFixResult('Apply', { attempted: 3, succeeded: 3, failed: [] }),
    ).toContain('3/3 entries classified');
  });

  it('returns partial failure summary', () => {
    const summary = summarizeBulkFixResult('Apply', {
      attempted: 3,
      succeeded: 2,
      failed: [{ itemId: 'e3', error: 'missing' }],
    });
    expect(summary).toContain('2/3 entries classified');
    expect(summary).toContain('1 failed');
  });
});

import { describe, expect, it } from 'vitest';
import type { EntryLevelIssueItem, NoWorkContextItem } from '../../lib/remediation/issue-queue';
import {
  getQueueCounters,
  getSuggestionQueueCounters,
  summarizeBulkFixResult,
} from './SettingsRemediationView';

function makeNeedsItem(overrides: Partial<EntryLevelIssueItem> = {}): EntryLevelIssueItem {
  return {
    category: 'needs_measurable_owner',
    taskId: 't1',
    scopeTaskId: 't1',
    entryId: 'e1',
    entryIds: ['e1'],
    entryCount: 1,
    taskTitle: 'Task 1',
    description: 'No measurable owner',
    suggestedTargetId: null,
    suggestedTargetTitle: null,
    recommendedWorkTypeId: null,
    conflictingRecommendedWorkTypeIds: [],
    suggestionSource: null,
    personHours: 1.5,
    ...overrides,
  };
}

describe('getSuggestionQueueCounters', () => {
  it('counts suggested vs manual-required items', () => {
    const items = [
      makeNeedsItem({ taskId: 't1', suggestedTargetId: 'owner-1', recommendedWorkTypeId: 'wt-1', suggestionSource: 'nearest' }),
      makeNeedsItem({ taskId: 't2', entryId: 'e2' }),
      makeNeedsItem({ taskId: 't3', entryId: 'e3', suggestedTargetId: 'owner-2', recommendedWorkTypeId: 'wt-2', suggestionSource: 'engine' }),
    ];

    const counters = getSuggestionQueueCounters(items);

    expect(counters.totalScopes).toBe(3);
    expect(counters.totalEntries).toBe(3);
    expect(counters.withSuggestion).toBe(2);
    expect(counters.manualRequired).toBe(1);
  });
});

describe('getQueueCounters', () => {
  it('counts scopes and entries for base queue fields', () => {
    const items: NoWorkContextItem[] = [
      {
        category: 'no_work_context',
        taskId: 'scope-1',
        scopeTaskId: 'scope-1',
        entryId: 'e1',
        entryIds: ['e1', 'e2'],
        entryCount: 2,
        taskTitle: 'Scope 1',
        description: 'Missing: work type',
        missingFields: ['work type'],
        personHours: 3,
      },
      {
        category: 'no_work_context',
        taskId: 'scope-2',
        scopeTaskId: 'scope-2',
        entryId: null,
        entryIds: [],
        entryCount: 0,
        taskTitle: 'Scope 2',
        description: 'Missing: work unit',
        missingFields: ['work unit'],
        personHours: 0,
      },
    ];

    const counters = getQueueCounters(items);

    expect(counters.totalScopes).toBe(2);
    expect(counters.totalEntries).toBe(2);
    expect(counters.manualRequired).toBe(2);
  });
});

describe('summarizeBulkFixResult', () => {
  it('returns no-eligible summary', () => {
    expect(
      summarizeBulkFixResult('Apply', { attempted: 0, succeeded: 0, failed: [] }),
    ).toContain('no eligible task scopes with recommended WorkType');
  });

  it('returns success summary', () => {
    expect(
      summarizeBulkFixResult('Apply', { attempted: 3, succeeded: 3, failed: [] }),
    ).toContain('3/3 scopes classified');
  });

  it('returns partial failure summary', () => {
    const summary = summarizeBulkFixResult('Apply', {
      attempted: 3,
      succeeded: 2,
      failed: [{ itemId: 'e3', error: 'missing' }],
    });
    expect(summary).toContain('2/3 scopes classified');
    expect(summary).toContain('1 failed');
  });
});

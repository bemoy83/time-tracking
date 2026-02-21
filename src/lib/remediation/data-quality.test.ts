import { describe, it, expect } from 'vitest';
import type { AttributionSummary } from '../types';
import type { IssueQueueResult } from './issue-queue';
import { computeDataQualityProgress, classifyQualityGrade } from './data-quality';

function makeSummary(overrides: Partial<AttributionSummary> = {}): AttributionSummary {
  return {
    engineVersion: 'v1',
    totalEntries: 100,
    attributed: 90,
    unattributed: 8,
    ambiguous: 2,
    totalPersonHours: 200,
    attributedPersonHours: 180,
    excludedPersonHours: 20,
    ambiguousSuggestedResolutions: 2,
    ambiguousResolvedByPolicy: 0,
    ...overrides,
  };
}

function makeIssues(overrides: Partial<IssueQueueResult> = {}): IssueQueueResult {
  return {
    needsMeasurableOwner: [],
    ambiguousOwner: [],
    noWorkContext: [],
    totalIssues: 0,
    totalAffectedHours: 0,
    ...overrides,
  };
}

describe('classifyQualityGrade', () => {
  it('returns excellent for >= 95%', () => {
    expect(classifyQualityGrade(95)).toBe('excellent');
    expect(classifyQualityGrade(100)).toBe('excellent');
  });

  it('returns good for >= 85%', () => {
    expect(classifyQualityGrade(85)).toBe('good');
    expect(classifyQualityGrade(94)).toBe('good');
  });

  it('returns fair for >= 70%', () => {
    expect(classifyQualityGrade(70)).toBe('fair');
    expect(classifyQualityGrade(84)).toBe('fair');
  });

  it('returns poor for < 70%', () => {
    expect(classifyQualityGrade(69)).toBe('poor');
    expect(classifyQualityGrade(0)).toBe('poor');
  });
});

describe('computeDataQualityProgress', () => {
  it('computes attribution rate from summary', () => {
    const result = computeDataQualityProgress(
      makeSummary({ totalEntries: 100, attributed: 90 }),
      makeIssues(),
    );

    expect(result.attributionRate).toBe(90);
    expect(result.grade).toBe('good');
  });

  it('returns 100% for empty dataset', () => {
    const result = computeDataQualityProgress(
      makeSummary({ totalEntries: 0, attributed: 0 }),
      makeIssues(),
    );

    expect(result.attributionRate).toBe(100);
    expect(result.grade).toBe('excellent');
  });

  it('includes issue counts by category', () => {
    const issues = makeIssues({
      needsMeasurableOwner: [{ category: 'needs_measurable_owner', taskId: 't1', entryId: 'e1', taskTitle: 'T', description: '', suggestedTargetId: null, suggestedTargetTitle: null, personHours: 3 }],
      ambiguousOwner: [
        { category: 'ambiguous_owner', taskId: 't2', entryId: 'e2', taskTitle: 'T2', description: '', suggestedTargetId: 't3', suggestedTargetTitle: 'T3', personHours: 2 },
        { category: 'ambiguous_owner', taskId: 't4', entryId: 'e4', taskTitle: 'T4', description: '', suggestedTargetId: 't5', suggestedTargetTitle: 'T5', personHours: 1 },
      ],
      noWorkContext: [],
      totalIssues: 3,
      totalAffectedHours: 6,
    });

    const result = computeDataQualityProgress(makeSummary(), issues);

    expect(result.issuesByCategory.needsMeasurableOwner).toBe(1);
    expect(result.issuesByCategory.ambiguousOwner).toBe(2);
    expect(result.issuesByCategory.noWorkContext).toBe(0);
    expect(result.totalOpenIssues).toBe(3);
    expect(result.affectedHours).toBe(6);
  });

  it('includes hours from summary', () => {
    const result = computeDataQualityProgress(
      makeSummary({ attributedPersonHours: 180, excludedPersonHours: 20 }),
      makeIssues(),
    );

    expect(result.attributedHours).toBe(180);
    expect(result.excludedHours).toBe(20);
  });

  it('rounds attribution rate to one decimal', () => {
    const result = computeDataQualityProgress(
      makeSummary({ totalEntries: 3, attributed: 2 }),
      makeIssues(),
    );

    // 2/3 = 66.666... → 66.7
    expect(result.attributionRate).toBe(66.7);
  });
});

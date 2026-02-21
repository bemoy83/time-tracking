/**
 * Data quality progress summary — team-facing view of attribution
 * health and remediation progress.
 */

import type { AttributionSummary } from '../types';
import type { IssueQueueResult } from './issue-queue';

export interface DataQualityProgress {
  /** Percentage of entries that are attributed (0-100). */
  attributionRate: number;
  /** Total time entries processed. */
  totalEntries: number;
  /** Person-hours fully attributed. */
  attributedHours: number;
  /** Person-hours excluded (unattributed + ambiguous). */
  excludedHours: number;
  /** Breakdown of open issues by category. */
  issuesByCategory: {
    needsMeasurableOwner: number;
    ambiguousOwner: number;
    noWorkContext: number;
  };
  /** Total open issues. */
  totalOpenIssues: number;
  /** Person-hours affected by open issues. */
  affectedHours: number;
  /** Quality grade based on attribution rate. */
  grade: QualityGrade;
}

export type QualityGrade = 'excellent' | 'good' | 'fair' | 'poor';

const GRADE_THRESHOLDS = {
  excellent: 95,
  good: 85,
  fair: 70,
} as const;

export function classifyQualityGrade(attributionRate: number): QualityGrade {
  if (attributionRate >= GRADE_THRESHOLDS.excellent) return 'excellent';
  if (attributionRate >= GRADE_THRESHOLDS.good) return 'good';
  if (attributionRate >= GRADE_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/**
 * Compute a data quality progress summary from attribution results
 * and issue queue output.
 */
export function computeDataQualityProgress(
  summary: AttributionSummary,
  issues: IssueQueueResult,
): DataQualityProgress {
  const attributionRate =
    summary.totalEntries > 0
      ? (summary.attributed / summary.totalEntries) * 100
      : 100; // no entries = "perfect"

  return {
    attributionRate: Math.round(attributionRate * 10) / 10,
    totalEntries: summary.totalEntries,
    attributedHours: summary.attributedPersonHours,
    excludedHours: summary.excludedPersonHours,
    issuesByCategory: {
      needsMeasurableOwner: issues.needsMeasurableOwner.length,
      ambiguousOwner: issues.ambiguousOwner.length,
      noWorkContext: issues.noWorkContext.length,
    },
    totalOpenIssues: issues.totalIssues,
    affectedHours: issues.totalAffectedHours,
    grade: classifyQualityGrade(attributionRate),
  };
}

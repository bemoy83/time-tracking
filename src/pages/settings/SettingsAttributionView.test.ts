import { describe, expect, it } from 'vitest';
import { buildAttributionStatusLine } from './SettingsAttributionView';
import type { AttributionDiagnostics } from '../../lib/attribution/diagnostics';

function makeDiagnostics(
  overrides: Partial<AttributionDiagnostics> = {},
): AttributionDiagnostics {
  return {
    policy: 'soft_allow_flag',
    computedAt: '2024-01-01T08:00:00.000Z',
    source: 'cache',
    summary: {
      engineVersion: 'v1',
      totalEntries: 10,
      attributed: 9,
      unattributed: 1,
      ambiguous: 0,
      totalPersonHours: 20,
      attributedPersonHours: 18,
      excludedPersonHours: 2,
      ambiguousSuggestedResolutions: 0,
      ambiguousResolvedByPolicy: 0,
    },
    queues: {
      needsMeasurableOwner: [],
      ambiguousOwner: [],
      noWorkContext: [],
      totalIssues: 1,
      totalAffectedHours: 2,
    },
    progress: {
      attributionRate: 90,
      totalEntries: 10,
      attributedHours: 18,
      excludedHours: 2,
      issuesByCategory: {
        needsMeasurableOwner: 1,
        ambiguousOwner: 0,
        noWorkContext: 0,
      },
      totalOpenIssues: 1,
      affectedHours: 2,
      grade: 'good',
    },
    ...overrides,
  };
}

describe('buildAttributionStatusLine', () => {
  it('returns empty-data message when diagnostics are absent', () => {
    expect(buildAttributionStatusLine(null)).toBe('No time entries yet.');
  });

  it('returns empty-data message when there are no entries', () => {
    const diagnostics = makeDiagnostics({
      summary: {
        ...makeDiagnostics().summary,
        totalEntries: 0,
      },
    });
    expect(buildAttributionStatusLine(diagnostics)).toBe('No time entries yet.');
  });

  it('returns compact status with updated timestamp when available', () => {
    const diagnostics = makeDiagnostics();
    const line = buildAttributionStatusLine(diagnostics);

    expect(line).toContain('90% attributed');
    expect(line).toContain('1 open issues');
    expect(line).toContain('2.0 affected hrs');
    expect(line).toContain('Updated');
  });

  it('omits updated suffix when computedAt is invalid', () => {
    const diagnostics = makeDiagnostics({ computedAt: 'invalid-date' });
    const line = buildAttributionStatusLine(diagnostics);

    expect(line).toContain('90% attributed');
    expect(line).not.toContain('Updated');
  });
});

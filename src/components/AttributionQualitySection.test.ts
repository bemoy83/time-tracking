/**
 * Tests for computeReasonBreakdown — the per-reason aggregation
 * of excluded entries displayed in AttributionQualitySection.
 */

import { describe, it, expect } from 'vitest';
import type { AttributedEntry } from '../lib/types';
import { computeReasonBreakdown } from './AttributionQualitySection';

function makeAttributedEntry(overrides: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    entryId: 'entry-1',
    taskId: 'task-1',
    ownerTaskId: 'task-1',
    status: 'attributed',
    reason: 'self',
    personHours: 1,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
    ...overrides,
  };
}

describe('computeReasonBreakdown', () => {
  it('returns empty array when all entries are attributed', () => {
    const entries = [
      makeAttributedEntry({ entryId: 'e1' }),
      makeAttributedEntry({ entryId: 'e2' }),
    ];

    expect(computeReasonBreakdown(entries)).toEqual([]);
  });

  it('aggregates excluded entries by reason', () => {
    const entries = [
      makeAttributedEntry({ entryId: 'e1', status: 'unattributed', reason: 'noMeasurableOwner', ownerTaskId: null, personHours: 2 }),
      makeAttributedEntry({ entryId: 'e2', status: 'unattributed', reason: 'noMeasurableOwner', ownerTaskId: null, personHours: 3 }),
      makeAttributedEntry({ entryId: 'e3', status: 'ambiguous', reason: 'multipleOwners', ownerTaskId: null, personHours: 1.5 }),
    ];

    const breakdown = computeReasonBreakdown(entries);

    expect(breakdown).toHaveLength(2);

    const noOwner = breakdown.find((b) => b.reason === 'noMeasurableOwner')!;
    expect(noOwner.entryCount).toBe(2);
    expect(noOwner.personHours).toBe(5);

    const multiOwner = breakdown.find((b) => b.reason === 'multipleOwners')!;
    expect(multiOwner.entryCount).toBe(1);
    expect(multiOwner.personHours).toBe(1.5);
  });

  it('sorts by personHours descending', () => {
    const entries = [
      makeAttributedEntry({ entryId: 'e1', status: 'unattributed', reason: 'noMeasurableOwner', ownerTaskId: null, personHours: 1 }),
      makeAttributedEntry({ entryId: 'e2', status: 'ambiguous', reason: 'multipleOwners', ownerTaskId: null, personHours: 10 }),
    ];

    const breakdown = computeReasonBreakdown(entries);
    expect(breakdown[0].reason).toBe('multipleOwners');
    expect(breakdown[1].reason).toBe('noMeasurableOwner');
  });

  it('handles empty input', () => {
    expect(computeReasonBreakdown([])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { round2, sameEffortMap, resolveEffectiveAccessHours, getCrewEquivalentForDate } from './capacity-math';
import { createLineItem } from '../plan-model';

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1); // JS float 1.005 = 1.00499..., rounds down
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(10)).toBe(10);
  });

  it('handles zero and negatives', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-1.555)).toBe(-1.55); // JS toFixed rounds toward zero for negatives
  });
});

describe('sameEffortMap', () => {
  it('returns true for equal maps', () => {
    expect(sameEffortMap({ '2026-03-01': 8 }, { '2026-03-01': 8 })).toBe(true);
  });

  it('returns false when values differ', () => {
    expect(sameEffortMap({ '2026-03-01': 8 }, { '2026-03-01': 7 })).toBe(false);
  });

  it('returns false when keys differ', () => {
    expect(sameEffortMap({ '2026-03-01': 8 }, { '2026-03-02': 8 })).toBe(false);
  });

  it('returns false when key counts differ', () => {
    expect(sameEffortMap({ '2026-03-01': 8, '2026-03-02': 4 }, { '2026-03-01': 8 })).toBe(false);
  });

  it('treats undefined as empty map', () => {
    expect(sameEffortMap(undefined, undefined)).toBe(true);
    expect(sameEffortMap(undefined, {})).toBe(true);
    expect(sameEffortMap({ '2026-03-01': 8 }, undefined)).toBe(false);
  });
});

describe('resolveEffectiveAccessHours', () => {
  it('returns effectiveAvailablePersonHours / availableCrew when crew > 0', () => {
    // 8 crew × 8h × 0.8 efficiency = 51.2h effective. 51.2 / 8 = 6.4
    expect(resolveEffectiveAccessHours(51.2, 8, 8)).toBe(6.4);
  });

  it('falls back to accessHours when availableCrew is 0', () => {
    expect(resolveEffectiveAccessHours(0, 0, 8)).toBe(8);
  });

  it('falls back to 8 when both crew and accessHours are 0', () => {
    expect(resolveEffectiveAccessHours(0, 0, 0)).toBe(8);
  });

  it('at full efficiency (1.0) returns raw accessHours', () => {
    // 4 crew × 8h × 1.0 = 32h. 32 / 4 = 8
    expect(resolveEffectiveAccessHours(32, 4, 8)).toBe(8);
  });
});

describe('getCrewEquivalentForDate', () => {
  it('converts person-hours to crew equivalent using effective access hours', () => {
    const item = createLineItem('T', 'T', 'pcs', 1, 1, 0);
    item.assemblyPersonHoursByDate = { '2026-03-01': 6.4 };
    // effectiveAccessHours = 6.4 → 6.4 / 6.4 = 1.0
    expect(getCrewEquivalentForDate(item, 'assembly', '2026-03-01', 6.4)).toBe(1);
  });

  it('returns 0 when accessHours is 0', () => {
    const item = createLineItem('T', 'T', 'pcs', 1, 1, 0);
    item.assemblyPersonHoursByDate = { '2026-03-01': 8 };
    expect(getCrewEquivalentForDate(item, 'assembly', '2026-03-01', 0)).toBe(0);
  });

  it('returns 0 for unassigned date', () => {
    const item = createLineItem('T', 'T', 'pcs', 1, 1, 0);
    expect(getCrewEquivalentForDate(item, 'assembly', '2026-03-01', 8)).toBe(0);
  });
});

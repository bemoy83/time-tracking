import { describe, expect, it } from 'vitest';
import {
  calculateBudgetStatusPersonHours,
  getEstimatedPersonMs,
} from './types';

describe('getEstimatedPersonMs', () => {
  it('returns null when estimate is missing or non-positive', () => {
    expect(getEstimatedPersonMs(null, 2)).toBeNull();
    expect(getEstimatedPersonMs(0, 2)).toBeNull();
    expect(getEstimatedPersonMs(-15, 2)).toBeNull();
  });

  it('defaults workers to one when defaultWorkers is null', () => {
    expect(getEstimatedPersonMs(60, null)).toBe(3_600_000);
  });

  it('scales estimate by default workers when provided', () => {
    expect(getEstimatedPersonMs(90, 3)).toBe(16_200_000);
  });
});

describe('calculateBudgetStatusPersonHours', () => {
  it('returns none when there is no valid estimate', () => {
    expect(calculateBudgetStatusPersonHours(1_000, null)).toEqual({
      status: 'none',
      percentUsed: 0,
      varianceMs: 0,
      varianceText: '',
    });
    expect(calculateBudgetStatusPersonHours(1_000, 0)).toEqual({
      status: 'none',
      percentUsed: 0,
      varianceMs: 0,
      varianceText: '',
    });
  });

  it('marks under when usage is below 75%', () => {
    const status = calculateBudgetStatusPersonHours(7_200_000, 14_400_000);
    expect(status.status).toBe('under');
    expect(status.percentUsed).toBe(50);
    expect(status.varianceMs).toBe(-7_200_000);
    expect(status.varianceText).toBe('Under by 2h');
  });

  it('marks approaching at 75%', () => {
    const status = calculateBudgetStatusPersonHours(10_800_000, 14_400_000);
    expect(status.status).toBe('approaching');
    expect(status.percentUsed).toBe(75);
    expect(status.varianceMs).toBe(-3_600_000);
    expect(status.varianceText).toBe('Under by 1h');
  });

  it('marks over at 100% and above', () => {
    const status = calculateBudgetStatusPersonHours(18_000_000, 14_400_000);
    expect(status.status).toBe('over');
    expect(status.percentUsed).toBe(125);
    expect(status.varianceMs).toBe(3_600_000);
    expect(status.varianceText).toBe('Over by 1h');
  });
});

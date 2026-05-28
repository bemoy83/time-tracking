import { describe, expect, it } from 'vitest';
import {
  getAssignedDates,
  resolveDefaultPersonHoursForAssignment,
  toggleAssignmentDate,
} from './assignment';

describe('toggleAssignmentDate', () => {
  it('adds first scheduled day when unscheduled', () => {
    const result = toggleAssignmentDate(
      { personHoursByDate: undefined },
      '2026-03-02',
      4,
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-02' });
    expect(result.personHoursByDate).toEqual({ '2026-03-02': 4 });
  });

  it('removes day effort and clears schedule when last date is removed', () => {
    const result = toggleAssignmentDate(
      { personHoursByDate: { '2026-03-02': 4 } },
      '2026-03-02',
      4,
    );
    expect(result.span).toEqual({ scheduledStart: null, scheduledEnd: null });
    expect(result.personHoursByDate).toBeUndefined();
  });

  it('preserves sparse gaps when toggling a middle date off', () => {
    const result = toggleAssignmentDate(
      { personHoursByDate: { '2026-03-02': 4, '2026-03-03': 4, '2026-03-04': 4 } },
      '2026-03-03',
      4,
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' });
    expect(result.personHoursByDate).toEqual({ '2026-03-02': 4, '2026-03-04': 4 });
  });
});

describe('resolveDefaultPersonHoursForAssignment', () => {
  it('uses a full preferred day when the row is already at target', () => {
    expect(resolveDefaultPersonHoursForAssignment(80, 80, 8)).toBe(8);
  });

  it('uses a full preferred day for dust remainders at 100%', () => {
    expect(resolveDefaultPersonHoursForAssignment(80, 79.99, 8)).toBe(8);
    expect(resolveDefaultPersonHoursForAssignment(80, 79.99, 8)).not.toBe(0.01);
  });

  it('caps to remaining effort when a meaningful amount is left', () => {
    expect(resolveDefaultPersonHoursForAssignment(80, 72, 8)).toBe(8);
    expect(resolveDefaultPersonHoursForAssignment(80, 77, 8)).toBe(3);
  });
});

describe('getAssignedDates', () => {
  it('returns sorted dates with effort', () => {
    const dates = getAssignedDates({
      personHoursByDate: {
        '2026-03-04': 4,
        '2026-03-02': 2,
      },
    });
    expect(dates).toEqual(['2026-03-02', '2026-03-04']);
  });

  it('returns empty array when no effort is planned', () => {
    expect(getAssignedDates({ personHoursByDate: undefined })).toEqual([]);
  });
});

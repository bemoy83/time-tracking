import { describe, expect, it } from 'vitest';
import { getAssignedDates, toggleAssignmentDate } from './assignment';

describe('toggleAssignmentDate', () => {
  it('adds first scheduled day when unscheduled', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: null, scheduledEnd: null, crewByDate: undefined, crew: 1 },
      '2026-03-02',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-02' });
    expect(result.crewByDate).toEqual({ '2026-03-02': 1 });
  });

  it('extends schedule range when clicking after span', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-03', crewByDate: { '2026-03-02': 1, '2026-03-03': 1 }, crew: 1 },
      '2026-03-05',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-05' });
    expect(result.crewByDate).toEqual({ '2026-03-02': 1, '2026-03-03': 1, '2026-03-05': 1 });
  });

  it('extends schedule range when clicking before span', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-04', scheduledEnd: '2026-03-05', crewByDate: { '2026-03-04': 1, '2026-03-05': 1 }, crew: 1 },
      '2026-03-02',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-05' });
    expect(result.crewByDate).toEqual({ '2026-03-04': 1, '2026-03-05': 1, '2026-03-02': 1 });
  });

  it('toggles middle day OFF — creates gap instead of clearing span', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04', crewByDate: { '2026-03-02': 1, '2026-03-03': 1, '2026-03-04': 1 }, crew: 1 },
      '2026-03-03',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' });
    expect(result.crewByDate).toEqual({ '2026-03-02': 1, '2026-03-04': 1 });
  });

  it('toggles gap day ON — re-assigns with crew=1', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04', crewByDate: { '2026-03-02': 1, '2026-03-04': 1 }, crew: 1 },
      '2026-03-03',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' });
    expect(result.crewByDate).toEqual({ '2026-03-02': 1, '2026-03-04': 1, '2026-03-03': 1 });
  });

  it('clears span when last assigned day is toggled off', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-02', crewByDate: { '2026-03-02': 1 }, crew: 1 },
      '2026-03-02',
    );
    expect(result.span).toEqual({ scheduledStart: null, scheduledEnd: null });
    expect(result.crewByDate).toBeUndefined();
  });

  it('clears span when toggling off last remaining crew day in multi-day span', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04', crewByDate: { '2026-03-03': 1 }, crew: 1 },
      '2026-03-03',
    );
    expect(result.span).toEqual({ scheduledStart: null, scheduledEnd: null });
    expect(result.crewByDate).toBeUndefined();
  });

  it('toggles edge day OFF without shrinking span', () => {
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04', crewByDate: { '2026-03-02': 1, '2026-03-03': 1, '2026-03-04': 1 }, crew: 1 },
      '2026-03-02',
    );
    expect(result.span).toEqual({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' });
    expect(result.crewByDate).toEqual({ '2026-03-03': 1, '2026-03-04': 1 });
  });

  it('handles legacy row without crewByDate — toggle inside span uses pf.crew as current', () => {
    // Legacy row: crewByDate undefined, crew=1, toggling inside span → should toggle off
    const result = toggleAssignmentDate(
      { scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04', crewByDate: undefined, crew: 1 },
      '2026-03-03',
    );
    // Without crewByDate, currentCrew = pf.crew = 1 (> 0), so toggling OFF
    // But crewByDate is undefined, so nextCrewByDate is undefined, hasAnyCrew = false → clears
    // This is the pre-migration behavior for direct calls; callers should lazy migrate first
    expect(result.span).toEqual({ scheduledStart: null, scheduledEnd: null });
    expect(result.crewByDate).toBeUndefined();
  });
});

describe('getAssignedDates', () => {
  it('returns all span dates when crewByDate is undefined (legacy)', () => {
    const dates = getAssignedDates({
      scheduledStart: '2026-03-02',
      scheduledEnd: '2026-03-04',
      crewByDate: undefined,
    });
    expect(dates).toEqual(['2026-03-02', '2026-03-03', '2026-03-04']);
  });

  it('returns only crew > 0 dates when crewByDate is defined', () => {
    const dates = getAssignedDates({
      scheduledStart: '2026-03-02',
      scheduledEnd: '2026-03-04',
      crewByDate: { '2026-03-02': 1, '2026-03-04': 1 },
    });
    expect(dates).toEqual(['2026-03-02', '2026-03-04']);
  });

  it('returns empty array when no span', () => {
    const dates = getAssignedDates({
      scheduledStart: null,
      scheduledEnd: null,
      crewByDate: undefined,
    });
    expect(dates).toEqual([]);
  });

  it('excludes dates with crew = 0 in crewByDate', () => {
    const dates = getAssignedDates({
      scheduledStart: '2026-03-02',
      scheduledEnd: '2026-03-04',
      crewByDate: { '2026-03-02': 1, '2026-03-03': 0, '2026-03-04': 2 },
    });
    expect(dates).toEqual(['2026-03-02', '2026-03-04']);
  });
});

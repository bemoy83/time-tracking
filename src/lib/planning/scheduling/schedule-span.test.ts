import { describe, expect, it } from 'vitest';
import {
  getScheduleRangeForWorkCalendar,
  getWorkCalendarPhaseSpans,
  type PhaseDateValues,
} from './schedule-span';

function makePhaseDates(overrides: Partial<PhaseDateValues> = {}): PhaseDateValues {
  return {
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    ...overrides,
  };
}

describe('schedule-span work-calendar helpers', () => {
  it('returns phase spans for assembly and dismantle independently', () => {
    const spans = getWorkCalendarPhaseSpans(
      makePhaseDates({
        assemblyStartDate: '2026-03-02',
        assemblyEndDate: '2026-03-03',
        dismantleStartDate: '2026-03-06',
        dismantleEndDate: '2026-03-07',
      }),
    );

    expect(spans).toEqual([
      { start: '2026-03-02', end: '2026-03-03' },
      { start: '2026-03-06', end: '2026-03-07' },
    ]);
  });

  it('does not use event dates to create a work-calendar range', () => {
    const range = getScheduleRangeForWorkCalendar(
      makePhaseDates(),
      '2026-03-10',
      '2026-03-12',
    );
    expect(range).toBeNull();
  });

  it('returns a phase summary range when at least one phase is complete', () => {
    const range = getScheduleRangeForWorkCalendar(
      makePhaseDates({
        dismantleStartDate: '2026-03-10',
        dismantleEndDate: '2026-03-12',
      }),
      null,
      null,
    );
    expect(range).toEqual({
      start: '2026-03-10',
      end: '2026-03-12',
      source: 'phase',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  dayEffectiveAvailablePersonHours,
  getEffectiveScheduleSpan,
  generateDefaultWorkCalendar,
  generateDefaultWorkCalendarForSpans,
  hasSchedulingCalendar,
  listDatesForSpans,
  listDateRange,
  reconcileWorkCalendar,
  reconcileWorkCalendarForSpans,
  resolveDayEfficiency,
} from './work-calendar';

describe('work-calendar', () => {
  it('lists inclusive date ranges', () => {
    expect(listDateRange('2026-03-01', '2026-03-03')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('generates weekday work days and weekend off days', () => {
    const calendar = generateDefaultWorkCalendar('2026-03-06', '2026-03-08', 8);
    expect(calendar).toHaveLength(3);
    expect(calendar[0].isWorkDay).toBe(true); // Friday
    expect(calendar[1].isWorkDay).toBe(false); // Saturday
    expect(calendar[2].isWorkDay).toBe(false); // Sunday
  });

  it('preserves existing overrides during reconcile', () => {
    const reconciled = reconcileWorkCalendar(
      [
        {
          date: '2026-03-03',
          isWorkDay: true,
          accessStart: '10:00',
          accessEnd: '16:00',
          crewSize: 5,
        },
      ],
      '2026-03-02',
      '2026-03-04',
      8,
    );
    const target = reconciled.find((day) => day.date === '2026-03-03');
    expect(target?.accessStart).toBe('10:00');
    expect(target?.crewSize).toBe(5);
  });

  it('lists unique dates across multiple spans without filling gaps', () => {
    expect(
      listDatesForSpans([
        { start: '2026-03-02', end: '2026-03-03' },
        { start: '2026-03-06', end: '2026-03-07' },
      ]),
    ).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-06',
      '2026-03-07',
    ]);
  });

  it('reconciles calendar for disjoint spans while preserving overrides', () => {
    const reconciled = reconcileWorkCalendarForSpans(
      [
        {
          date: '2026-03-03',
          isWorkDay: true,
          accessStart: '10:00',
          accessEnd: '16:00',
          crewSize: 5,
        },
      ],
      [
        { start: '2026-03-02', end: '2026-03-03' },
        { start: '2026-03-06', end: '2026-03-07' },
      ],
      8,
    );

    expect(reconciled.map((day) => day.date)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-06',
      '2026-03-07',
    ]);
    expect(reconciled.find((day) => day.date === '2026-03-03')?.accessStart).toBe('10:00');
    expect(reconciled.find((day) => day.date === '2026-03-03')?.crewSize).toBe(5);
  });

  it('applies weekend-off defaults when generating from spans', () => {
    const calendar = generateDefaultWorkCalendarForSpans(
      [{ start: '2026-03-06', end: '2026-03-08' }],
      8,
    );
    expect(calendar).toHaveLength(3);
    expect(calendar[0].isWorkDay).toBe(true); // Friday
    expect(calendar[1].isWorkDay).toBe(false); // Saturday
    expect(calendar[2].isWorkDay).toBe(false); // Sunday
  });

  it('computes available person-hours from access window and crew', () => {
    const day = {
      date: '2026-03-01',
      isWorkDay: true,
      accessStart: '08:00',
      accessEnd: '14:00',
      crewSize: 4,
    };
    expect(dayAccessHours(day)).toBe(6);
    expect(dayAvailablePersonHours(day, 8)).toBe(24);
  });

  it('reports scheduling calendar availability from calendar length only', () => {
    expect(
      hasSchedulingCalendar({
        workCalendar: [],
      }),
    ).toBe(false);
    expect(
      hasSchedulingCalendar({
        workCalendar: [
          {
            date: '2026-03-01',
            isWorkDay: true,
            accessStart: '08:00',
            accessEnd: '16:00',
            crewSize: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it('returns effective schedule span from phase dates before event dates', () => {
    expect(
      getEffectiveScheduleSpan({
        eventStartDate: null,
        eventEndDate: null,
        assemblyStartDate: '2026-03-01',
        assemblyEndDate: '2026-03-03',
        dismantleStartDate: '2026-03-08',
        dismantleEndDate: '2026-03-10',
      }),
    ).toEqual({
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(
      getEffectiveScheduleSpan({
        eventStartDate: '2026-03-04',
        eventEndDate: '2026-03-06',
        assemblyStartDate: null,
        assemblyEndDate: null,
        dismantleStartDate: null,
        dismantleEndDate: null,
      }),
    ).toEqual({
      start: '2026-03-04',
      end: '2026-03-06',
    });
  });
});

const BASE_DAY = {
  date: '2026-03-01',
  isWorkDay: true as const,
  accessStart: '08:00',
  accessEnd: '16:00',
  crewSize: 4,
};

describe('resolveDayEfficiency', () => {
  it('returns planEfficiency when day.efficiency is null', () => {
    expect(resolveDayEfficiency({ ...BASE_DAY, efficiency: null }, 0.8)).toBe(0.8);
  });

  it('returns per-day override when set', () => {
    expect(resolveDayEfficiency({ ...BASE_DAY, efficiency: 0.7 }, 0.8)).toBe(0.7);
  });

  it('clamps per-day efficiency below 0.5 to 0.5 (minimum floor)', () => {
    // normalizePlanEfficiency clamps to [0.5, 1.0]; 0.3 → 0.5 (not null — clamps, does not reject)
    expect(resolveDayEfficiency({ ...BASE_DAY, efficiency: 0.3 }, 0.8)).toBe(0.5);
  });

  it('clamps per-day efficiency above 1.0 to 1.0', () => {
    expect(resolveDayEfficiency({ ...BASE_DAY, efficiency: 1.5 }, 0.8)).toBe(1.0);
  });
});

describe('dayEffectiveAvailablePersonHours', () => {
  it('applies plan efficiency when day.efficiency is null', () => {
    // 4 crew × 8h × 0.8 = 25.6
    expect(dayEffectiveAvailablePersonHours({ ...BASE_DAY, efficiency: null }, 4, 0.8)).toBe(25.6);
  });

  it('applies per-day efficiency override', () => {
    // 4 crew × 8h × 0.7 = 22.4 (plan efficiency 0.8 overridden by day 0.7)
    expect(dayEffectiveAvailablePersonHours({ ...BASE_DAY, efficiency: 0.7 }, 4, 0.8)).toBe(22.4);
  });

  it('returns 0 for off days', () => {
    expect(dayEffectiveAvailablePersonHours({ ...BASE_DAY, isWorkDay: false, efficiency: null }, 4, 0.8)).toBe(0);
  });
});

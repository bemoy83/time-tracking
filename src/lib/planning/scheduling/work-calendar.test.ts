import { describe, expect, it } from 'vitest';
import {
  dayAccessHours,
  dayAvailablePersonHours,
  getEffectiveScheduleSpan,
  generateDefaultWorkCalendar,
  hasSchedulingCalendar,
  listDateRange,
  reconcileWorkCalendar,
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
        buildUpStartDate: '2026-03-01',
        buildUpEndDate: '2026-03-03',
        tearDownStartDate: '2026-03-08',
        tearDownEndDate: '2026-03-10',
      }),
    ).toEqual({
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(
      getEffectiveScheduleSpan({
        eventStartDate: '2026-03-04',
        eventEndDate: '2026-03-06',
        buildUpStartDate: null,
        buildUpEndDate: null,
        tearDownStartDate: null,
        tearDownEndDate: null,
      }),
    ).toEqual({
      start: '2026-03-04',
      end: '2026-03-06',
    });
  });
});

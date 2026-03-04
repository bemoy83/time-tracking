import { describe, expect, it } from 'vitest';
import { createPlan, type Plan } from '../plan-model';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from './crew-pool-calendar';

function makePlan(id: string, title: string, start: string, end: string, defaultCrewSize: number): Plan {
  return {
    ...createPlan(title),
    id,
    eventStartDate: start,
    eventEndDate: end,
    defaultCrewSize,
  };
}

describe('crew-pool-calendar', () => {
  it('derives max default crew size across selected plans', () => {
    const plans = [
      makePlan('a', 'Plan A', '2026-03-01', '2026-03-02', 3),
      makePlan('b', 'Plan B', '2026-03-03', '2026-03-05', 8),
    ];

    expect(deriveCrewPoolDefaultCrewSize(plans)).toBe(8);
  });

  it('builds a calendar across the union schedule span using weekday defaults', () => {
    const plans = [
      makePlan('a', 'Plan A', '2026-03-02', '2026-03-03', 2),
      makePlan('b', 'Plan B', '2026-03-05', '2026-03-06', 6),
    ];

    const calendar = deriveCrewPoolCalendar(plans);

    expect(calendar[0].date).toBe('2026-03-02');
    expect(calendar[calendar.length - 1].date).toBe('2026-03-06');
    expect(calendar).toHaveLength(5);
    expect(calendar.every((day) => day.isWorkDay)).toBe(true);
  });

  it('preserves existing day overrides when selection changes and calendar is reconciled', () => {
    const plans = [
      makePlan('a', 'Plan A', '2026-03-02', '2026-03-04', 4),
    ];

    const existing = [
      { date: '2026-03-02', isWorkDay: true, accessStart: '10:00', accessEnd: '16:00', crewSize: 9 },
      { date: '2026-03-03', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
      { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '14:00', crewSize: null },
    ];

    const calendar = deriveCrewPoolCalendar(plans, {
      defaultCrewSize: 4,
      existingCalendar: existing,
    });

    expect(calendar.find((day) => day.date === '2026-03-02')?.accessStart).toBe('10:00');
    expect(calendar.find((day) => day.date === '2026-03-02')?.crewSize).toBe(9);
    expect(calendar.find((day) => day.date === '2026-03-03')?.isWorkDay).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createPlan, type Plan } from '../plan-model';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from './crew-pool-calendar';

function makePlan(
  id: string,
  title: string,
  defaultCrewSize: number,
  options: {
    assembly?: { start: string; end: string };
    dismantle?: { start: string; end: string };
  } = {},
): Plan {
  const plan = createPlan(title);
  return {
    ...plan,
    id,
    defaultCrewSize,
    assemblyStartDate: options.assembly?.start ?? plan.assemblyStartDate,
    assemblyEndDate: options.assembly?.end ?? plan.assemblyEndDate,
    dismantleStartDate: options.dismantle?.start ?? plan.dismantleStartDate,
    dismantleEndDate: options.dismantle?.end ?? plan.dismantleEndDate,
  };
}

describe('crew-pool-calendar', () => {
  it('derives max default crew size across selected plans', () => {
    const plans = [
      makePlan('a', 'Plan A', 3),
      makePlan('b', 'Plan B', 8),
    ];

    expect(deriveCrewPoolDefaultCrewSize(plans)).toBe(8);
  });

  it('builds a calendar across the union of phase windows using weekday defaults', () => {
    const plans = [
      makePlan('a', 'Plan A', 2, { assembly: { start: '2026-03-02', end: '2026-03-03' } }),
      makePlan('b', 'Plan B', 6, { assembly: { start: '2026-03-05', end: '2026-03-06' } }),
    ];

    const calendar = deriveCrewPoolCalendar(plans);

    expect(calendar[0].date).toBe('2026-03-02');
    expect(calendar[calendar.length - 1].date).toBe('2026-03-06');
    expect(calendar).toHaveLength(4);
    expect(calendar.every((day) => day.isWorkDay)).toBe(true);
  });

  it('does not fill the gap between assembly and dismantle for a single plan', () => {
    const plans = [
      makePlan('a', 'Plan A', 4, {
        assembly: { start: '2026-03-02', end: '2026-03-03' },
        dismantle: { start: '2026-03-06', end: '2026-03-07' },
      }),
    ];

    const calendar = deriveCrewPoolCalendar(plans);
    const dates = calendar.map((day) => day.date);
    expect(dates).toEqual(['2026-03-02', '2026-03-03', '2026-03-06', '2026-03-07']);
  });

  it('preserves existing day overrides when selection changes and calendar is reconciled', () => {
    const plans = [
      makePlan('a', 'Plan A', 4, { assembly: { start: '2026-03-02', end: '2026-03-04' } }),
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

import { describe, expect, it } from 'vitest';
import { buildDayStates, simulatePlacement, type DayState } from './placement';

const BASE_DAY = {
  isWorkDay: true as const,
  accessStart: '08:00',
  accessEnd: '16:00',
  crewSize: null,
  efficiency: null,
};

function makeCalendar(dates: string[]) {
  return dates.map((date) => ({ ...BASE_DAY, date }));
}

describe('simulatePlacement', () => {
  it('places all work in one day when capacity allows', () => {
    const days: DayState[] = [
      { date: '2026-03-01', accessHours: 8, remainingPersonHours: 64, baseEffectivePersonHours: 64 },
      { date: '2026-03-02', accessHours: 8, remainingPersonHours: 64, baseEffectivePersonHours: 64 },
    ];
    const result = simulatePlacement(days, 32, 4, false);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.personHoursByDate)).toHaveLength(1);
    expect(result!.personHoursByDate['2026-03-01']).toBe(32);
    expect(result!.assignedPH).toBe(32);
  });

  it('spans multiple days when single day is insufficient', () => {
    const days: DayState[] = [
      { date: '2026-03-01', accessHours: 8, remainingPersonHours: 16, baseEffectivePersonHours: 16 },
      { date: '2026-03-02', accessHours: 8, remainingPersonHours: 16, baseEffectivePersonHours: 16 },
      { date: '2026-03-03', accessHours: 8, remainingPersonHours: 16, baseEffectivePersonHours: 16 },
    ];
    const result = simulatePlacement(days, 40, 2, false);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.personHoursByDate).length).toBeGreaterThan(1);
    expect(result!.assignedPH).toBe(40); // 3 days × 16h capacity = 48h available; fills 16+16+8=40
  });

  it('returns null when no capacity available', () => {
    const days: DayState[] = [
      { date: '2026-03-01', accessHours: 8, remainingPersonHours: 0, baseEffectivePersonHours: 0 },
    ];
    const result = simulatePlacement(days, 8, 1, false);
    expect(result).toBeNull();
  });

  it('respects preferredDayTarget as chunking cap', () => {
    const days: DayState[] = [
      { date: '2026-03-01', accessHours: 8, remainingPersonHours: 64, baseEffectivePersonHours: 64 },
      { date: '2026-03-02', accessHours: 8, remainingPersonHours: 64, baseEffectivePersonHours: 64 },
    ];
    // preferredCrew=2 → preferredDayTarget = 16h/day
    const result = simulatePlacement(days, 20, 2, false);
    expect(result).not.toBeNull();
    expect(result!.personHoursByDate['2026-03-01']).toBe(16);
    expect(result!.personHoursByDate['2026-03-02']).toBe(4);
  });
});

describe('buildDayStates', () => {
  it('subtracts committed hours from available capacity', () => {
    const calendar = makeCalendar(['2026-03-01', '2026-03-02']);
    const committed = new Map([['2026-03-01', 16]]);
    // 4 crew × 8h × 1.0 efficiency = 32h/day. Day 1: 32 - 16 = 16h remaining
    const states = buildDayStates(calendar, 4, 1.0, committed);
    expect(states[0]!.remainingPersonHours).toBe(16);
    expect(states[1]!.remainingPersonHours).toBe(32);
  });

  it('excludes off days', () => {
    const calendar = [
      { ...BASE_DAY, date: '2026-03-01' },
      { ...BASE_DAY, date: '2026-03-02', isWorkDay: false as const },
    ];
    const states = buildDayStates(calendar, 4, 1.0, new Map());
    expect(states).toHaveLength(1);
    expect(states[0]!.date).toBe('2026-03-01');
  });

  it('applies efficiency to available capacity', () => {
    const calendar = makeCalendar(['2026-03-01']);
    // 4 crew × 8h × 0.8 = 25.6h
    const states = buildDayStates(calendar, 4, 0.8, new Map());
    expect(states[0]!.remainingPersonHours).toBe(25.6);
  });

  it('applies per-day efficiency override', () => {
    const calendar = [{ ...BASE_DAY, date: '2026-03-01', efficiency: 0.7 }];
    // 4 crew × 8h × 0.7 = 22.4h (plan efficiency 0.8 is overridden by day 0.7)
    const states = buildDayStates(calendar, 4, 0.8, new Map());
    expect(states[0]!.remainingPersonHours).toBe(22.4);
  });
});

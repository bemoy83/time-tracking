import { describe, expect, it } from 'vitest';
import { createPlan, type WorkCalendarDay } from '../../lib/planning/plan-model';
import {
  syncSharedCrewPoolDayToPlan,
  updateSharedCrewPoolCalendarDay,
} from './SharedScheduleView';

describe('shared schedule calendar helpers', () => {
  it('adds a toggled virtual full-span day to the crew pool calendar', () => {
    const calendar: WorkCalendarDay[] = [
      { date: '2026-03-01', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
      { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    ];

    const next = updateSharedCrewPoolCalendarDay(calendar, '2026-03-02', { isWorkDay: true });

    expect(next.map((day) => day.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
    expect(next[1]).toEqual({
      date: '2026-03-02',
      isWorkDay: true,
      accessStart: '08:00',
      accessEnd: '16:00',
      crewSize: null,
      efficiency: null,
    });
  });

  it('adds an enabled extended-zone day to an affected plan', () => {
    const plan = createPlan('Plan A');
    plan.assemblyStartDate = '2026-03-01';
    plan.assemblyEndDate = '2026-03-01';
    plan.eventStartDate = '2026-03-03';
    plan.eventEndDate = '2026-03-03';
    plan.dismantleStartDate = '2026-03-05';
    plan.dismantleEndDate = '2026-03-05';
    plan.workCalendar = [
      { date: '2026-03-01', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-05', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    ];

    const next = syncSharedCrewPoolDayToPlan(plan, '2026-03-02', { isWorkDay: true });

    expect(next.workCalendar.map((day) => day.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-05']);
    expect(next.workCalendar.find((day) => day.date === '2026-03-02')?.isWorkDay).toBe(true);
  });
});

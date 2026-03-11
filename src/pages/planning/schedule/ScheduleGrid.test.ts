import { describe, expect, it } from 'vitest';
import { createLineItem, type WorkCalendarDay } from '../../../lib/planning/plan-model';
import { getSchedulableUnscheduledPhaseRowCount } from './ScheduleGrid';
import type { PhaseDateValues } from './schedule-date-ui';

function workDays(...dates: string[]): WorkCalendarDay[] {
  return dates.map((date) => ({
    date,
    isWorkDay: true,
    accessStart: '08:00',
    accessEnd: '16:00',
    crewSize: 4,
  }));
}

const phaseDates: PhaseDateValues = {
  buildUpStartDate: '2026-03-02',
  buildUpEndDate: '2026-03-06',
  tearDownStartDate: '2026-03-09',
  tearDownEndDate: '2026-03-11',
};

describe('getSchedulableUnscheduledPhaseRowCount', () => {
  it('counts partially unscheduled phase rows (not only fully unscheduled items)', () => {
    const item = createLineItem('Dual', 'Dual', 'm2', 100, 10, 10);
    item.buildUpCrew = 2;
    item.tearDownCrew = 2;
    item.buildUpScheduledStart = '2026-03-02';
    item.buildUpScheduledEnd = '2026-03-03';
    item.buildUpCrewByDate = { '2026-03-02': 2, '2026-03-03': 2 };

    const count = getSchedulableUnscheduledPhaseRowCount(
      [item],
      phaseDates,
      workDays('2026-03-02', '2026-03-03', '2026-03-09', '2026-03-10', '2026-03-11'),
    );

    expect(count).toBe(1);
  });

  it('does not count rows without a valid required-work source', () => {
    const item = createLineItem('Incomplete', 'Incomplete', 'm2', 100, 0, 0);
    item.buildUpCrew = 2; // active phase, but no time estimate and no rate
    item.buildUpTimeHours = 0;
    item.buildUpRate = 0;

    const count = getSchedulableUnscheduledPhaseRowCount(
      [item],
      phaseDates,
      workDays('2026-03-02', '2026-03-03', '2026-03-04'),
    );

    expect(count).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../plan-model';
import { autoSchedule } from './auto-schedule';

function makePhasePlan(): Plan {
  return {
    ...createPlan('Phase Auto Plan'),
    eventStartDate: null,
    eventEndDate: null,
    buildUpStartDate: '2026-03-01',
    buildUpEndDate: '2026-03-02',
    tearDownStartDate: '2026-03-04',
    tearDownEndDate: '2026-03-05',
    defaultCrewSize: 2,
    workCalendar: [
      { date: '2026-03-01', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-03', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
      { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-05', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    ],
  };
}

describe('autoSchedule', () => {
  it('schedules phase items only inside their phase windows', () => {
    const plan = makePhasePlan();

    const buildItem = createLineItem('Build item', 'Build', 'pcs', 'build-up', 8, 1);
    buildItem.crew = 1;
    buildItem.timeHours = 8;

    const tearItem = createLineItem('Tear item', 'Tear', 'pcs', 'tear-down', 8, 1);
    tearItem.crew = 1;
    tearItem.timeHours = 8;

    plan.lineItems = [buildItem, tearItem];

    const scheduled = autoSchedule(plan);
    const scheduledBuild = scheduled.lineItems.find((item) => item.id === buildItem.id)!;
    const scheduledTear = scheduled.lineItems.find((item) => item.id === tearItem.id)!;

    expect(scheduledBuild.scheduledStart).toBeTruthy();
    expect(scheduledBuild.scheduledEnd).toBeTruthy();
    expect(scheduledBuild.scheduledStart! >= '2026-03-01').toBe(true);
    expect(scheduledBuild.scheduledEnd! <= '2026-03-02').toBe(true);

    expect(scheduledTear.scheduledStart).toBeTruthy();
    expect(scheduledTear.scheduledEnd).toBeTruthy();
    expect(scheduledTear.scheduledStart! >= '2026-03-04').toBe(true);
    expect(scheduledTear.scheduledEnd! <= '2026-03-05').toBe(true);
  });

  it('returns unchanged plan when work calendar is empty', () => {
    const plan = {
      ...createPlan('No Calendar'),
      buildUpStartDate: '2026-03-01',
      buildUpEndDate: '2026-03-02',
      tearDownStartDate: '2026-03-04',
      tearDownEndDate: '2026-03-05',
      lineItems: [createLineItem('Item', 'Item', 'pcs', 'build-up', 8, 1)],
    };

    const next = autoSchedule(plan);
    expect(next).toBe(plan);
  });
});

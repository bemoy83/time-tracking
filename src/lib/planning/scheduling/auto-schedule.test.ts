import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, getPhaseFields } from '../plan-model';
import { runAutoSchedule } from './auto-schedule';

function makePlan() {
  const plan = createPlan('Auto');
  plan.assemblyStartDate = '2026-03-02';
  plan.assemblyEndDate = '2026-03-04';
  plan.defaultCrewSize = 4;
  plan.workCalendar = [
    { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: 4 },
    { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00', crewSize: 4 },
  ];
  return plan;
}

describe('runAutoSchedule', () => {
  it('writes personHoursByDate for scheduled work', () => {
    const plan = makePlan();
    const item = createLineItem('Install', 'Install', 'pcs', 16, 2, 0);
    item.assemblyCrew = 2;
    item.assemblyTimeHours = 4;
    plan.lineItems = [item];

    const { plan: scheduled, report } = runAutoSchedule(plan);
    const pf = getPhaseFields(scheduled.lineItems[0]!, 'assembly');

    expect(report.changed).toHaveLength(1);
    expect(pf.personHoursByDate).toBeTruthy();
    expect(Object.values(pf.personHoursByDate ?? {}).reduce((sum, value) => sum + value, 0)).toBe(8);
    expect(pf.scheduledStart).toBe('2026-03-02');
  });

  it('reports unresolved rows when work cannot be fully placed', () => {
    const plan = makePlan();
    const item = createLineItem('Large', 'Large', 'pcs', 16, 1, 0);
    item.assemblyCrew = 4;
    item.assemblyTimeHours = 30;
    plan.lineItems = [item];

    const { report } = runAutoSchedule(plan);
    expect(report.unresolved.length).toBeGreaterThan(0);
    expect(report.unresolved[0]?.reason).toBe('no_capacity_window');
  });
});

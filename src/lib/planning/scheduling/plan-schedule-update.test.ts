import { describe, expect, it } from 'vitest';
import { createPlan } from '../plan-model';
import {
  setPlanEventDate,
  setPlanPhaseDate,
} from './plan-schedule-update';

describe('plan-schedule-update calendar reconciliation', () => {
  it('reconciles work calendar from build-up and tear-down independently', () => {
    let plan = createPlan('Phase-only calendar');
    plan = setPlanPhaseDate(plan, 'buildUpStartDate', '2026-03-02');
    plan = setPlanPhaseDate(plan, 'buildUpEndDate', '2026-03-03');
    plan = setPlanPhaseDate(plan, 'tearDownStartDate', '2026-03-06');
    plan = setPlanPhaseDate(plan, 'tearDownEndDate', '2026-03-07');

    expect(plan.workCalendar.map((day) => day.date)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-06',
      '2026-03-07',
    ]);
    expect(plan.workCalendar.find((day) => day.date === '2026-03-07')?.isWorkDay).toBe(false); // Saturday
  });

  it('does not change work calendar when only event dates are edited', () => {
    let plan = createPlan('Event-neutral');
    plan = setPlanPhaseDate(plan, 'buildUpStartDate', '2026-03-02');
    plan = setPlanPhaseDate(plan, 'buildUpEndDate', '2026-03-03');
    const before = plan.workCalendar;

    plan = setPlanEventDate(plan, 'eventStartDate', '2026-03-10');
    plan = setPlanEventDate(plan, 'eventEndDate', '2026-03-12');

    expect(plan.workCalendar).toEqual(before);
  });
});

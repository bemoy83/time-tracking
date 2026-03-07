import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan, type Plan } from '../plan-model';
import { autoSchedule } from './auto-schedule';

function makePhasePlan(overrides?: Partial<Plan>): Plan {
  return {
    ...createPlan('Phase Auto Plan'),
    eventStartDate: null,
    eventEndDate: null,
    buildUpStartDate: '2026-03-02',
    buildUpEndDate: '2026-03-06',
    tearDownStartDate: '2026-03-09',
    tearDownEndDate: '2026-03-11',
    defaultCrewSize: 4,
    workCalendar: [
      // Build-up week: Mon–Fri
      { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-05', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-06', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      // Weekend off
      { date: '2026-03-07', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
      { date: '2026-03-08', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
      // Tear-down: Mon–Wed
      { date: '2026-03-09', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-10', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      { date: '2026-03-11', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
    ],
    ...overrides,
  };
}

function makeItem(
  title: string,
  phase: 'build-up' | 'tear-down',
  quantity: number,
  rate: number,
  crew: number,
) {
  const item = createLineItem(title, title, 'm2', phase, quantity, rate);
  item.crew = crew;
  item.timeHours = crew > 0 && rate > 0 ? quantity / (rate * crew) : 0;
  return item;
}

function getItem(plan: Plan, id: string) {
  return plan.lineItems.find((i) => i.id === id)!;
}

describe('autoSchedule', () => {
  it('returns unchanged plan when work calendar is empty', () => {
    const plan = {
      ...createPlan('No Calendar'),
      lineItems: [makeItem('Item', 'build-up', 100, 10, 2)],
    };
    expect(autoSchedule(plan)).toBe(plan);
  });

  it('returns unchanged plan when no work days exist', () => {
    const plan = makePhasePlan({
      workCalendar: [
        { date: '2026-03-02', isWorkDay: false, accessStart: null, accessEnd: null, crewSize: null },
      ],
    });
    plan.lineItems = [makeItem('Item', 'build-up', 100, 10, 2)];
    expect(autoSchedule(plan)).toBe(plan);
  });

  it('returns unchanged plan when all items are already scheduled', () => {
    const plan = makePhasePlan();
    const item = makeItem('Already done', 'build-up', 100, 10, 2);
    item.scheduledStart = '2026-03-02';
    item.scheduledEnd = '2026-03-03';
    plan.lineItems = [item];
    expect(autoSchedule(plan)).toBe(plan);
  });

  it('schedules build-up items only within build-up phase dates', () => {
    const plan = makePhasePlan();
    plan.lineItems = [makeItem('Build item', 'build-up', 80, 10, 2)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    expect(scheduled.scheduledStart).toBeTruthy();
    expect(scheduled.scheduledEnd).toBeTruthy();
    expect(scheduled.scheduledStart! >= '2026-03-02').toBe(true);
    expect(scheduled.scheduledEnd! <= '2026-03-06').toBe(true);
  });

  it('schedules tear-down items only within tear-down phase dates', () => {
    const plan = makePhasePlan();
    plan.lineItems = [makeItem('Tear item', 'tear-down', 48, 8, 2)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    expect(scheduled.scheduledStart).toBeTruthy();
    expect(scheduled.scheduledEnd).toBeTruthy();
    expect(scheduled.scheduledStart! >= '2026-03-09').toBe(true);
    expect(scheduled.scheduledEnd! <= '2026-03-11').toBe(true);
  });

  it('produces tight spans — a small task should not spread across all days', () => {
    const plan = makePhasePlan();
    // 16 PH = 2 crew × 8 hours = fits in 1 day
    plan.lineItems = [makeItem('Quick job', 'build-up', 16, 1, 2)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    expect(scheduled.scheduledStart).toBe(scheduled.scheduledEnd);
  });

  it('extends span when work requires multiple days', () => {
    const plan = makePhasePlan();
    // 64 PH = 2 crew × 8 hrs/day × 4 days
    plan.lineItems = [makeItem('Big job', 'build-up', 64, 1, 2)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    const assignedDays = Object.keys(scheduled.crewByDate ?? {}).length;
    expect(assignedDays).toBe(4);
  });

  it('derives crew = 1 when item has no crew set', () => {
    const plan = makePhasePlan();
    const item = makeItem('No crew', 'build-up', 8, 1, 0);
    item.crew = 0;
    item.timeHours = 0;
    plan.lineItems = [item];

    const result = autoSchedule(plan);
    const scheduled = getItem(result, item.id);

    expect(scheduled.crew).toBe(1);
    expect(scheduled.timeHours).toBe(8);
    expect(scheduled.scheduledStart).toBeTruthy();
  });

  it('respects crew pool — concurrent items share available crew', () => {
    const plan = makePhasePlan({ defaultCrewSize: 4 });
    // Two items each want 3 crew. With 4 total crew, they should NOT
    // both land on the same single day — the second should shift.
    const itemA = makeItem('Item A', 'build-up', 24, 1, 3); // 24 PH, 3 crew, 1 day
    const itemB = makeItem('Item B', 'build-up', 24, 1, 3); // 24 PH, 3 crew, 1 day
    plan.lineItems = [itemA, itemB];

    const result = autoSchedule(plan);
    const a = getItem(result, itemA.id);
    const b = getItem(result, itemB.id);

    // Both should be scheduled
    expect(a.scheduledStart).toBeTruthy();
    expect(b.scheduledStart).toBeTruthy();

    // They should not fully overlap — at most 4 crew on any day
    const crewPerDay = new Map<string, number>();
    for (const [date, crew] of Object.entries(a.crewByDate ?? {})) {
      crewPerDay.set(date, (crewPerDay.get(date) ?? 0) + crew);
    }
    for (const [date, crew] of Object.entries(b.crewByDate ?? {})) {
      crewPerDay.set(date, (crewPerDay.get(date) ?? 0) + crew);
    }

    // With 4 crew available, items wanting 3 each cannot overlap.
    // The algorithm should place them on different days.
    for (const [, total] of crewPerDay) {
      expect(total).toBeLessThanOrEqual(4);
    }
  });

  it('reduces crew and extends span when pool is tight', () => {
    const plan = makePhasePlan({ defaultCrewSize: 2 });
    // Item wants 4 crew but only 2 available — should reduce to 2 and double the span
    // 32 PH at 4 crew = 1 day, at 2 crew = 2 days
    plan.lineItems = [makeItem('Big crew', 'build-up', 32, 1, 4)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    expect(scheduled.scheduledStart).toBeTruthy();
    const crewValues = Object.values(scheduled.crewByDate ?? {});
    expect(crewValues.length).toBeGreaterThanOrEqual(2);
    for (const c of crewValues) {
      expect(c).toBeLessThanOrEqual(2);
    }
  });

  it('reserves crew for already-scheduled items', () => {
    const plan = makePhasePlan({ defaultCrewSize: 4 });

    // Pre-scheduled item takes 3 crew on Mar 02
    const existing = makeItem('Existing', 'build-up', 24, 1, 3);
    existing.scheduledStart = '2026-03-02';
    existing.scheduledEnd = '2026-03-02';
    existing.crewByDate = { '2026-03-02': 3 };

    // New item wants 3 crew for 1 day — should avoid Mar 02
    const newItem = makeItem('New', 'build-up', 24, 1, 3);
    plan.lineItems = [existing, newItem];

    const result = autoSchedule(plan);
    const scheduled = getItem(result, newItem.id);

    expect(scheduled.scheduledStart).toBeTruthy();
    expect(scheduled.scheduledStart).not.toBe('2026-03-02');
  });

  it('handles varying access hours across days', () => {
    const plan = makePhasePlan({
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '12:00', crewSize: null }, // 4 hrs
        { date: '2026-03-03', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null }, // 8 hrs
        { date: '2026-03-04', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null }, // 8 hrs
      ],
      buildUpEndDate: '2026-03-04',
    });
    // 16 PH with 2 crew = 1 full 8-hour day
    plan.lineItems = [makeItem('Half day aware', 'build-up', 16, 1, 2)];

    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);
    expect(scheduled.scheduledStart).toBeTruthy();
  });

  it('falls back gracefully when crew is fully exhausted (over-allocation)', () => {
    const plan = makePhasePlan({
      defaultCrewSize: 2,
      buildUpStartDate: '2026-03-02',
      buildUpEndDate: '2026-03-02',
      workCalendar: [
        { date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null },
      ],
    });

    // Pre-scheduled takes all 2 crew
    const existing = makeItem('Full', 'build-up', 16, 1, 2);
    existing.scheduledStart = '2026-03-02';
    existing.scheduledEnd = '2026-03-02';
    existing.crewByDate = { '2026-03-02': 2 };

    // New item also needs crew — only 1 day available, must over-allocate
    const newItem = makeItem('Extra', 'build-up', 8, 1, 1);
    plan.lineItems = [existing, newItem];

    const result = autoSchedule(plan);
    const scheduled = getItem(result, newItem.id);

    // Should still be scheduled (over-allocation is allowed, capacity view flags it)
    expect(scheduled.scheduledStart).toBe('2026-03-02');
  });

  it('schedules mixed build-up and tear-down items into correct phases', () => {
    const plan = makePhasePlan();
    const buildItem = makeItem('Build', 'build-up', 16, 1, 2);
    const tearItem = makeItem('Tear', 'tear-down', 16, 1, 2);
    plan.lineItems = [buildItem, tearItem];

    const result = autoSchedule(plan);
    const b = getItem(result, buildItem.id);
    const t = getItem(result, tearItem.id);

    expect(b.scheduledEnd! <= '2026-03-06').toBe(true);
    expect(t.scheduledStart! >= '2026-03-09').toBe(true);
  });

  it('leaves items with zero workQuantity unscheduled', () => {
    const plan = makePhasePlan();
    const item = makeItem('Empty', 'build-up', 0, 10, 2);
    plan.lineItems = [item];

    const result = autoSchedule(plan);
    expect(result).toBe(plan);
  });

  it('sets crewByDate for each assigned work day', () => {
    const plan = makePhasePlan();
    plan.lineItems = [makeItem('Crew tracking', 'build-up', 32, 1, 2)];
    const result = autoSchedule(plan);
    const scheduled = getItem(result, plan.lineItems[0].id);

    const dates = Object.keys(scheduled.crewByDate ?? {});
    expect(dates.length).toBeGreaterThan(0);
    for (const crew of Object.values(scheduled.crewByDate ?? {})) {
      expect(crew).toBe(2);
    }
    // crewByDate dates should be within scheduled span
    for (const date of dates) {
      expect(date >= scheduled.scheduledStart!).toBe(true);
      expect(date <= scheduled.scheduledEnd!).toBe(true);
    }
  });
});

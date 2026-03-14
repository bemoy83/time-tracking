import { describe, expect, it } from 'vitest';
import { createLineItem } from '../../../../lib/planning/plan-model';
import {
  getLastDayBreakdown,
  getScheduledHours,
  getWorkHoursForDay,
  isOverTargetCell,
  isOverWorkerForDay,
} from './schedule-grid-metrics';

describe('schedule-grid-metrics', () => {
  it('flags last-day deficit when work cannot finish in assigned window', () => {
    const item = createLineItem('Audio', 'Audio', 'pcs', 1, 1, 0);
    item.assemblyCrew = 1;
    item.assemblyTimeHours = 20;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';

    const dayByDate = new Map([
      ['2026-03-02', { accessHours: 8 }],
      ['2026-03-03', { accessHours: 8 }],
    ]);
    const assignedDates = ['2026-03-02', '2026-03-03'];

    const breakdown = getLastDayBreakdown(item, 'assembly', '2026-03-03', dayByDate, assignedDates);
    expect(breakdown).toEqual({
      assignedPersonHours: 8,
      remainingAtStart: 12,
      deficit: 4,
    });
    expect(isOverWorkerForDay(item, 'assembly', '2026-03-03', dayByDate, assignedDates)).toBe(true);
  });

  it('detects over-target assignment on completion day', () => {
    const item = createLineItem('Rigging', 'Rigging', 'pcs', 1, 1, 0);
    item.assemblyCrew = 2;
    item.assemblyTimeHours = 12;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-03';

    const dayByDate = new Map([
      ['2026-03-02', { accessHours: 8 }],
      ['2026-03-03', { accessHours: 8 }],
    ]);
    const assignedDates = ['2026-03-02', '2026-03-03'];

    const breakdown = getLastDayBreakdown(item, 'assembly', '2026-03-03', dayByDate, assignedDates);
    expect(breakdown).toEqual({
      assignedPersonHours: 16,
      remainingAtStart: 8,
    });
    expect(isOverTargetCell(breakdown)).toBe(true);
  });

  it('does not count hours on non-work days', () => {
    const item = createLineItem('Lighting', 'Lighting', 'pcs', 1, 1, 0);
    item.assemblyCrew = 2;
    item.assemblyTimeHours = 4;
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';

    const dayByDate = new Map([
      ['2026-03-02', { accessHours: 0 }],
    ]);
    const assignedDates = ['2026-03-02'];

    expect(getWorkHoursForDay(item, 'assembly', '2026-03-02', dayByDate, assignedDates)).toBe(0);
    expect(getScheduledHours(item, 'assembly', assignedDates, dayByDate)).toBe(0);
  });
});

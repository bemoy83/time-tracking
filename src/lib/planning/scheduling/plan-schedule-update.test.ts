import { describe, expect, it } from 'vitest';
import { createLineItem, createPlan } from '../plan-model';
import type { Project } from '../../types';
import {
  applyProjectPhaseDatesToPlan,
  setPlanEventDate,
  setPlanPhaseDate,
  updateLineItemAssignment,
} from './plan-schedule-update';

describe('plan-schedule-update calendar reconciliation', () => {
  it('reconciles work calendar from assembly and dismantle independently', () => {
    let plan = createPlan('Phase-only calendar');
    plan = setPlanPhaseDate(plan, 'assemblyStartDate', '2026-03-02');
    plan = setPlanPhaseDate(plan, 'assemblyEndDate', '2026-03-03');
    plan = setPlanPhaseDate(plan, 'dismantleStartDate', '2026-03-06');
    plan = setPlanPhaseDate(plan, 'dismantleEndDate', '2026-03-07');

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
    plan = setPlanPhaseDate(plan, 'assemblyStartDate', '2026-03-02');
    plan = setPlanPhaseDate(plan, 'assemblyEndDate', '2026-03-03');
    const before = plan.workCalendar;

    plan = setPlanEventDate(plan, 'eventStartDate', '2026-03-10');
    plan = setPlanEventDate(plan, 'eventEndDate', '2026-03-12');

    expect(plan.workCalendar).toEqual(before);
  });

  it('replaces plan dates from project phase dates and reconciles the calendar once', () => {
    const plan = createPlan('Project linked');
    const project: Project = {
      id: 'project-1',
      name: 'Spring Expo',
      color: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      assemblyStartDate: '2026-05-01',
      assemblyEndDate: '2026-05-03',
      dismantleStartDate: '2026-05-08',
      dismantleEndDate: '2026-05-09',
      eventStartDate: '2026-05-05',
      eventEndDate: '2026-05-06',
    };

    const updated = applyProjectPhaseDatesToPlan(plan, project);

    expect(updated.assemblyStartDate).toBe('2026-05-01');
    expect(updated.eventEndDate).toBe('2026-05-06');
    expect(updated.workCalendar.map((day) => day.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-08',
      '2026-05-09',
    ]);
  });

  it('clears personHoursByDate when a phase schedule is removed', () => {
    const plan = createPlan('Clear assignment');
    const item = createLineItem('Install', 'Install', 'pcs', 8, 1, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    item.assemblyPersonHoursByDate = { '2026-03-02': 8 };
    plan.lineItems = [item];

    const updated = updateLineItemAssignment(
      plan,
      item.id,
      'assembly',
      { scheduledStart: null, scheduledEnd: null },
      undefined,
    );

    const cleared = updated.lineItems[0];
    expect(cleared.assemblyScheduledStart).toBeNull();
    expect(cleared.assemblyScheduledEnd).toBeNull();
    expect(cleared.assemblyPersonHoursByDate).toBeUndefined();
  });
});

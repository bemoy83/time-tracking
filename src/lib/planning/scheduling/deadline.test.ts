import { describe, expect, it } from 'vitest';
import type { Task, TimeEntry } from '../../types';
import { createLineItem, createPlan } from '../plan-model';
import { computePlanDeadlineSummary, evaluateLineItemDeadline } from './deadline';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: 'project-1',
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: 10,
    workUnit: 'm2',
    crew: 1,
    targetProductivity: 2,
    phase: 'assembly',
    workTypeId: 'wt-1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    sourcePlanId: 'plan-1',
    sourceLineItemId: 'line-1',
    excludeFromKpi: false,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    startUtc: '2026-03-02T08:00:00.000Z',
    endUtc: '2026-03-02T10:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'synced',
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateLineItemDeadline', () => {
  it('marks overdue when past due and incomplete', () => {
    const item = createLineItem('Install', 'Carpet', 'm2', 10, 2, 0);
    item.assemblyScheduledStart = '2026-03-01';
    item.assemblyScheduledEnd = '2026-03-01';
    const result = evaluateLineItemDeadline(item, 'assembly', [makeTask({ status: 'active' })], [], '2026-03-02');
    expect(result.status).toBe('overdue');
  });

  it('marks done-on-time when completed by due date', () => {
    const item = createLineItem('Install', 'Carpet', 'm2', 10, 2, 0);
    item.assemblyScheduledStart = '2026-03-02';
    item.assemblyScheduledEnd = '2026-03-02';
    const task = makeTask({ status: 'completed' });
    const entry = makeEntry({ endUtc: '2026-03-02T12:00:00.000Z' });
    const result = evaluateLineItemDeadline(item, 'assembly', [task], [entry], '2026-03-02');
    expect(result.status).toBe('done-on-time');
  });
});

describe('computePlanDeadlineSummary', () => {
  it('returns disabled when no line items are scheduled', () => {
    const plan = createPlan('P');
    const summary = computePlanDeadlineSummary(plan, [], '2026-03-02');
    expect(summary.enabled).toBe(false);
  });

  it('returns behind when overdue exists', () => {
    const plan = createPlan('P');
    plan.lineItems = [createLineItem('Install', 'Carpet', 'm2', 10, 2, 0)];
    plan.lineItems[0].assemblyScheduledStart = '2026-03-02';
    plan.lineItems[0].assemblyScheduledEnd = '2026-03-02';
    plan.workCalendar = [{ date: '2026-03-02', isWorkDay: true, accessStart: '08:00', accessEnd: '16:00', crewSize: null }];
    const summary = computePlanDeadlineSummary(
      plan,
      [{ status: 'overdue', dueDate: '2026-03-02', actualStartDate: null, actualEndDate: null }],
      '2026-03-02',
    );
    expect(summary.enabled).toBe(true);
    expect(summary.status).toBe('behind');
  });
});

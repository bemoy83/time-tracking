/**
 * Tests for attribution utils — sumAttributedPersonHours and addActiveTimerContribution.
 * Uses real findMeasurableOwner (pure, deterministic).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, ActiveTimer, AttributedEntry } from '../types';
import { sumAttributedPersonHours, addActiveTimerContribution } from './utils';

// --- factories ---
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'active',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    workTypeId: null,
    ...overrides,
  };
}

function makeAttributedEntry(overrides: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    entryId: 'e-1',
    taskId: 'task-1',
    ownerTaskId: 'task-1',
    status: 'attributed',
    reason: 'self',
    personHours: 1,
    suggestedOwnerTaskId: null,
    heuristicUsed: null,
    ...overrides,
  };
}

function makeTimer(overrides: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    id: 'timer-1',
    taskId: 'task-1',
    startUtc: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
    source: 'manual',
    workers: 1,
    ...overrides,
  };
}

// --- sumAttributedPersonHours ---

describe('sumAttributedPersonHours', () => {
  it('sums person-hours for entries belonging to the given task', () => {
    const map = new Map<string, AttributedEntry[]>();
    map.set('task-1', [
      makeAttributedEntry({ entryId: 'e1', personHours: 2 }),
      makeAttributedEntry({ entryId: 'e2', personHours: 3.5 }),
    ]);

    expect(sumAttributedPersonHours(map, 'task-1')).toBe(5.5);
  });

  it('returns 0 when task has no entries', () => {
    const map = new Map<string, AttributedEntry[]>();
    expect(sumAttributedPersonHours(map, 'task-1')).toBe(0);
  });

  it('returns 0 for an empty entries array', () => {
    const map = new Map<string, AttributedEntry[]>();
    map.set('task-1', []);
    expect(sumAttributedPersonHours(map, 'task-1')).toBe(0);
  });
});

// --- addActiveTimerContribution ---

describe('addActiveTimerContribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds person-ms when timer task attributes to the target task (self)', () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });

    const timer = makeTimer({
      taskId: 'parent',
      startUtc: '2024-06-15T09:00:00.000Z', // 1 hour ago
      workers: 2,
    });

    const result = addActiveTimerContribution(
      'parent',
      ['parent'],
      [timer],
      [parent],
    );

    // 1 hour = 3_600_000ms × 2 workers = 7_200_000
    expect(result).toBe(7_200_000);
  });

  it('adds person-ms when subtask timer attributes to parent (unmeasurable subtask)', () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const child = makeTask({
      id: 'child',
      parentId: 'parent',
      // Not measurable — no workQuantity/workUnit/workTypeId
    });

    const timer = makeTimer({
      taskId: 'child',
      startUtc: '2024-06-15T09:30:00.000Z', // 30 min ago
      workers: 1,
    });

    const result = addActiveTimerContribution(
      'parent',
      ['parent', 'child'],
      [timer],
      [parent, child],
    );

    // 30 min = 1_800_000ms × 1 worker
    expect(result).toBe(1_800_000);
  });

  it('excludes timer when measurable subtask owns itself', () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const measurableChild = makeTask({
      id: 'child',
      parentId: 'parent',
      workQuantity: 50,
      workUnit: 'm2',
      workTypeId: 'wt-child',
    });

    const timer = makeTimer({
      taskId: 'child',
      startUtc: '2024-06-15T09:00:00.000Z',
      workers: 1,
    });

    const result = addActiveTimerContribution(
      'parent',
      ['parent', 'child'],
      [timer],
      [parent, measurableChild],
    );

    // Measurable child owns itself, so timer does NOT attribute to parent
    expect(result).toBe(0);
  });

  it('excludes timer when subtask has quantity context (no workTypeId)', () => {
    const parent = makeTask({
      id: 'parent',
      workQuantity: 100,
      workUnit: 'm2',
      workTypeId: 'wt-1',
    });
    const child = makeTask({
      id: 'child',
      parentId: 'parent',
      workQuantity: 50,
      workUnit: 'm2',
      // No workTypeId — but has quantity context, so self-owns
    });

    const timer = makeTimer({
      taskId: 'child',
      startUtc: '2024-06-15T09:00:00.000Z',
      workers: 1,
    });

    const result = addActiveTimerContribution(
      'parent',
      ['parent', 'child'],
      [timer],
      [parent, child],
    );

    // Child has quantity context → self-owns → does NOT attribute to parent
    expect(result).toBe(0);
  });

  it('returns 0 when no active timers match timerTaskIds', () => {
    const parent = makeTask({ id: 'parent', workQuantity: 100, workUnit: 'm2', workTypeId: 'wt-1' });

    const timer = makeTimer({ taskId: 'unrelated' });

    const result = addActiveTimerContribution(
      'parent',
      ['parent'],
      [timer],
      [parent],
    );

    expect(result).toBe(0);
  });

  it('returns 0 when there are no active timers', () => {
    const parent = makeTask({ id: 'parent', workQuantity: 100, workUnit: 'm2', workTypeId: 'wt-1' });

    const result = addActiveTimerContribution(
      'parent',
      ['parent'],
      [],
      [parent],
    );

    expect(result).toBe(0);
  });
});

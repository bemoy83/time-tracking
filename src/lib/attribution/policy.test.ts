import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { attributeEntry, attributeEntries } from './engine';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
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

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'source',
    startUtc: '2024-01-01T08:00:00.000Z',
    endUtc: '2024-01-01T09:00:00.000Z',
    source: 'manual',
    workers: 1,
    syncStatus: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildHeuristicScenario(): Map<string, Task> {
  const source = makeTask({
    id: 'source',
    projectId: 'p1',
    workUnit: 'm2',
    buildPhase: 'build-up',
    workTypeId: null,
  });
  const candidate = makeTask({
    id: 'candidate',
    projectId: 'p1',
    workQuantity: 50,
    workUnit: 'm2',
    buildPhase: 'build-up',
    workTypeId: 'wt-1',
  });
  const unrelated = makeTask({
    id: 'other',
    projectId: 'p2',
    workQuantity: 50,
    workUnit: 'pcs',
    buildPhase: 'tear-down',
    workTypeId: 'wt-2',
  });

  return new Map([
    ['source', source],
    ['candidate', candidate],
    ['other', unrelated],
  ]);
}

describe('Attribution policy behavior', () => {
  it('soft_allow_flag keeps entry unattributed but exposes suggestion metadata', () => {
    const result = attributeEntry(makeEntry(), buildHeuristicScenario(), 'soft_allow_flag');
    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
    expect(result.suggestedOwnerTaskId).toBe('candidate');
    expect(result.heuristicUsed).toBe('unit-phase');
    expect(result.reason).toBe('noMeasurableOwner');
  });

  it('strict_block suppresses suggestions', () => {
    const result = attributeEntry(makeEntry(), buildHeuristicScenario(), 'strict_block');
    expect(result.status).toBe('unattributed');
    expect(result.ownerTaskId).toBeNull();
    expect(result.suggestedOwnerTaskId).toBeNull();
    expect(result.heuristicUsed).toBeNull();
    expect(result.reason).toBe('noMeasurableOwner');
  });

  it('soft_allow_pick_nearest auto-applies suggested owner', () => {
    const result = attributeEntry(makeEntry(), buildHeuristicScenario(), 'soft_allow_pick_nearest');
    expect(result.status).toBe('attributed');
    expect(result.ownerTaskId).toBe('candidate');
    expect(result.suggestedOwnerTaskId).toBe('candidate');
    expect(result.heuristicUsed).toBe('unit-phase');
    expect(result.reason).toBe('policySuggestedOwner');
  });

  it('summary counters reflect suggested vs policy-applied behavior', () => {
    const entries = [makeEntry({ id: 'e1' })];
    const tasks = buildHeuristicScenario();

    const soft = attributeEntries(entries, tasks, 'soft_allow_flag').summary;
    const strict = attributeEntries(entries, tasks, 'strict_block').summary;
    const pick = attributeEntries(entries, tasks, 'soft_allow_pick_nearest').summary;

    expect(soft.ambiguousSuggestedResolutions).toBe(1);
    expect(strict.ambiguousSuggestedResolutions).toBe(0);
    expect(pick.ambiguousResolvedByPolicy).toBe(1);
    expect(pick.attributed).toBe(1);
  });
});


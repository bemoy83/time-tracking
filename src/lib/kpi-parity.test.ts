/**
 * KPI ↔ Calculator parity test — verifies that both paths consume
 * the same attributed dataset and produce consistent productivity rates.
 *
 * This test exercises the same data flow used by KpiSection and CalculatorSheet:
 *   buildAttributedRollup → computeWorkTypeKpis → findKpiByKey
 *
 * The Calculator uses KPI results directly for its productivity input,
 * so parity means: for any given Work Type, the KPI avgProductivity
 * equals the rate the Calculator would use.
 */

import { describe, it, expect } from 'vitest';
import type { Task, TimeEntry, AttributedEntry } from './types';
import { computeWorkTypeKpis, findKpiByKey, type WorkTypeKey } from './kpi';
import { attributeEntries } from './attribution/engine';

// --- factories ---
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'completed',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: null,
    workCategory: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
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

describe('KPI ↔ Calculator parity', () => {
  it('KPI avgProductivity matches what Calculator would consume', () => {
    // Setup: two completed tasks, same work type
    const t1 = makeTask({
      id: 't1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
      buildPhase: 'build-up',
    });
    const t2 = makeTask({
      id: 't2',
      workQuantity: 200,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
      buildPhase: 'build-up',
    });

    // Entries logged on each task
    const entries: TimeEntry[] = [
      makeEntry({ id: 'e1', taskId: 't1', workers: 2 }), // 2 person-hrs
      makeEntry({ id: 'e2', taskId: 't2', workers: 4 }), // 4 person-hrs
    ];

    const taskMap = new Map([['t1', t1], ['t2', t2]]);

    // Step 1: Attribution (same call both paths use)
    const { results } = attributeEntries(entries, taskMap);

    // Step 2: Group by ownerTaskId (same as buildAttributedRollup)
    const entriesByTask = new Map<string, AttributedEntry[]>();
    for (const r of results) {
      if (r.ownerTaskId) {
        const existing = entriesByTask.get(r.ownerTaskId) ?? [];
        existing.push(r);
        entriesByTask.set(r.ownerTaskId, existing);
      }
    }

    // Step 3: KPI computation (KpiSection path)
    const kpis = computeWorkTypeKpis([t1, t2], entriesByTask);

    // Step 4: Calculator lookup (CalculatorSheet path)
    const key: WorkTypeKey = {
      workCategory: 'carpet-tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
    };
    const kpi = findKpiByKey(kpis, key);

    // Parity assertion: Calculator sees the same rate KpiSection shows
    expect(kpi).toBeDefined();
    // (100 + 200) / (2 + 4) = 50 units/person-hr
    expect(kpi!.avgProductivity).toBe(50);
    expect(kpi!.totalPersonHours).toBe(6);
    expect(kpi!.totalQuantity).toBe(300);
    expect(kpi!.sampleCount).toBe(2);
  });

  it('excluded entries do not pollute KPI productivity', () => {
    // Measurable task + unmeasurable task with entries
    const measurable = makeTask({
      id: 'm1',
      workQuantity: 100,
      workUnit: 'm2',
      workCategory: 'carpet-tiles',
      buildPhase: 'build-up',
    });
    const unmeasurable = makeTask({ id: 'u1' });

    const entries: TimeEntry[] = [
      makeEntry({ id: 'e1', taskId: 'm1', workers: 2 }),  // 2 person-hrs → attributed
      makeEntry({ id: 'e2', taskId: 'u1', workers: 5 }),  // 5 person-hrs → unattributed
    ];

    const taskMap = new Map([['m1', measurable], ['u1', unmeasurable]]);
    const { results, summary } = attributeEntries(entries, taskMap);

    // Verify exclusion
    expect(summary.excludedPersonHours).toBe(5);

    // Build KPI from attributed entries only
    const entriesByTask = new Map<string, AttributedEntry[]>();
    for (const r of results) {
      if (r.ownerTaskId) {
        const existing = entriesByTask.get(r.ownerTaskId) ?? [];
        existing.push(r);
        entriesByTask.set(r.ownerTaskId, existing);
      }
    }

    const kpis = computeWorkTypeKpis([measurable, unmeasurable], entriesByTask);
    expect(kpis).toHaveLength(1);

    // Productivity should only reflect measurable entry: 100 / 2 = 50
    expect(kpis[0].avgProductivity).toBe(50);
    expect(kpis[0].totalPersonHours).toBe(2);
  });

  it('Calculator fallback (no buildPhase) matches KPI with null phase', () => {
    const task = makeTask({
      id: 't1',
      workQuantity: 80,
      workUnit: 'pcs',
      workCategory: 'furniture',
      buildPhase: null, // no phase
    });

    const entries: TimeEntry[] = [
      makeEntry({ id: 'e1', taskId: 't1', workers: 1 }), // 1 person-hr
    ];

    const taskMap = new Map([['t1', task]]);
    const { results } = attributeEntries(entries, taskMap);

    const entriesByTask = new Map<string, AttributedEntry[]>();
    for (const r of results) {
      if (r.ownerTaskId) {
        entriesByTask.set(r.ownerTaskId, [r]);
      }
    }

    const kpis = computeWorkTypeKpis([task], entriesByTask);

    // Calculator fallback: search without buildPhase
    const fallbackKey: WorkTypeKey = {
      workCategory: 'furniture',
      workUnit: 'pcs',
      buildPhase: null,
    };
    const kpi = findKpiByKey(kpis, fallbackKey);

    expect(kpi).toBeDefined();
    expect(kpi!.avgProductivity).toBe(80); // 80 pcs / 1 person-hr
  });
});

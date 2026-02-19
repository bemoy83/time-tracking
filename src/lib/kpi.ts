/**
 * KPI computation for completed tasks.
 * Groups by Work Type (workCategory + workUnit + buildPhase)
 * and calculates average achieved productivity.
 */

import type { Task, TimeEntry, WorkCategory, WorkUnit, BuildPhase } from './types';
import { durationMs } from './types';

export interface WorkTypeKey {
  workCategory: WorkCategory;
  workUnit: WorkUnit;
  buildPhase: BuildPhase | null;
}

export interface WorkTypeKpi {
  key: WorkTypeKey;
  sampleCount: number;
  avgProductivity: number; // units/person-hr
  totalQuantity: number;
  totalPersonHours: number;
}

function workTypeKeyString(key: WorkTypeKey): string {
  return `${key.workCategory}:${key.workUnit}:${key.buildPhase ?? '_'}`;
}

/**
 * Compute KPIs grouped by Work Type from completed tasks and their time entries.
 * @param tasks All tasks (will be filtered to completed with work data)
 * @param entriesByTask Map of taskId → TimeEntry[] for qualifying tasks
 */
export function computeWorkTypeKpis(
  tasks: Task[],
  entriesByTask: Map<string, TimeEntry[]>
): WorkTypeKpi[] {
  // Filter to completed tasks with required work data
  const qualifying = tasks.filter(
    (t) =>
      t.status === 'completed' &&
      t.workCategory != null &&
      t.workUnit != null &&
      t.workQuantity != null &&
      t.workQuantity > 0
  );

  // Accumulate per Work Type
  const groups = new Map<
    string,
    { key: WorkTypeKey; totalQuantity: number; totalPersonHours: number; sampleCount: number }
  >();

  for (const task of qualifying) {
    const entries = entriesByTask.get(task.id) ?? [];

    // Compute person-hours from time entries
    let personMs = 0;
    for (const entry of entries) {
      personMs += durationMs(entry.startUtc, entry.endUtc) * entry.workers;
    }

    // Skip tasks with no tracked time
    if (personMs <= 0) continue;

    const key: WorkTypeKey = {
      workCategory: task.workCategory!,
      workUnit: task.workUnit!,
      buildPhase: task.buildPhase,
    };
    const keyStr = workTypeKeyString(key);

    const existing = groups.get(keyStr);
    if (existing) {
      existing.totalQuantity += task.workQuantity!;
      existing.totalPersonHours += personMs / 3_600_000;
      existing.sampleCount += 1;
    } else {
      groups.set(keyStr, {
        key,
        totalQuantity: task.workQuantity!,
        totalPersonHours: personMs / 3_600_000,
        sampleCount: 1,
      });
    }
  }

  // Build result array
  const results: WorkTypeKpi[] = [];
  for (const group of groups.values()) {
    results.push({
      key: group.key,
      sampleCount: group.sampleCount,
      avgProductivity: group.totalQuantity / group.totalPersonHours,
      totalQuantity: group.totalQuantity,
      totalPersonHours: group.totalPersonHours,
    });
  }

  // Sort by category, then unit, then phase
  results.sort((a, b) => {
    const cmp = a.key.workCategory.localeCompare(b.key.workCategory);
    if (cmp !== 0) return cmp;
    const cmp2 = a.key.workUnit.localeCompare(b.key.workUnit);
    if (cmp2 !== 0) return cmp2;
    return (a.key.buildPhase ?? '').localeCompare(b.key.buildPhase ?? '');
  });

  return results;
}

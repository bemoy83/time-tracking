/**
 * Archived KPI recomputation tooling grouped by archive engine version.
 */

import { getAllTasks, getAllWorkTypes } from '../db';
import { buildAttributedRollup } from '../attributed-rollup';
import { computeWorkTypeKpis, type OutlierHandlingMode, type WorkTypeKpi } from '../kpi';
import { DEFAULT_ATTRIBUTION_POLICY, nowUtc, type AttributionPolicy, type Task, type WorkType } from '../types';

export interface RecomputedArchiveKpiGroup {
  archiveVersion: string;
  taskCount: number;
  kpis: WorkTypeKpi[];
}

export interface RecomputeArchivedKpisResult {
  recomputedAt: string;
  totalArchivedTasks: number;
  groups: RecomputedArchiveKpiGroup[];
}

export interface RecomputeArchivedKpisOptions {
  policy?: AttributionPolicy;
  outlierMode?: OutlierHandlingMode;
  archiveVersion?: string;
}

function normalizeArchiveVersion(value: string | null): string {
  return value ?? 'unknown';
}

function groupTasksByArchiveVersion(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const version = normalizeArchiveVersion(task.archiveVersion);
    const existing = groups.get(version);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(version, [task]);
    }
  }
  return groups;
}

async function recomputeGroupKpis(
  groupTasks: Task[],
  allTasks: Task[],
  workTypes: WorkType[],
  policy: AttributionPolicy,
  outlierMode: OutlierHandlingMode,
): Promise<WorkTypeKpi[]> {
  const rollup = await buildAttributedRollup(groupTasks, allTasks, policy);
  return computeWorkTypeKpis(groupTasks, rollup.entriesByTask, {
    workTypes,
    archiveOnly: true,
    outlierMode,
  });
}

export async function recomputeArchivedKpisByVersion(
  options: RecomputeArchivedKpisOptions = {},
): Promise<RecomputeArchivedKpisResult> {
  const {
    policy = DEFAULT_ATTRIBUTION_POLICY,
    outlierMode = 'report_only',
    archiveVersion,
  } = options;
  const [allTasks, workTypes] = await Promise.all([getAllTasks(), getAllWorkTypes()]);
  const archived = allTasks.filter((task) => task.archivedAt != null);
  const grouped = groupTasksByArchiveVersion(archived);

  const versions = Array.from(grouped.keys())
    .sort((a, b) => a.localeCompare(b))
    .filter((version) => archiveVersion == null || version === archiveVersion);

  const groups: RecomputedArchiveKpiGroup[] = [];
  for (const version of versions) {
    const tasksInGroup = grouped.get(version) ?? [];
    const kpis = await recomputeGroupKpis(
      tasksInGroup,
      allTasks,
      workTypes,
      policy,
      outlierMode,
    );
    groups.push({
      archiveVersion: version,
      taskCount: tasksInGroup.length,
      kpis,
    });
  }

  return {
    recomputedAt: nowUtc(),
    totalArchivedTasks: archived.length,
    groups,
  };
}

/**
 * useProjectMetrics hook.
 * Computes summary metrics for a project from top-level tasks:
 * counts, tracked time, person-hours, estimate/budget summary, and optional work quantity.
 */

import {
  Task,
  WorkUnit,
  calculateBudgetStatusPersonHours,
  getEstimatedPersonMs,
} from '../types';
import type { TaskTimes } from './useTaskTimes';

export interface ProjectMetrics {
  totalTasks: number;
  doneCount: number;
  blockedCount: number;
  activeCount: number;
  totalTimeMs: number;
  personHours: number;
  estimatedPersonHours: number | null;
  tasksWithEstimate: number;
  budgetOverCount: number;
  budgetUnderCount: number;
  budgetApproachingCount: number;
  workQuantityByUnit: Map<WorkUnit, number>;
}

export function useProjectMetrics(
  projectTasks: Task[],
  taskTimes: TaskTimes,
): ProjectMetrics {
  const { durationByTask, personMsByTask } = taskTimes;

  const totalTasks = projectTasks.length;
  let doneCount = 0;
  let blockedCount = 0;
  let activeCount = 0;
  let totalTimeMs = 0;
  let totalPersonMs = 0;
  let estimatedPersonMsTotal = 0;
  let tasksWithEstimate = 0;
  let budgetOverCount = 0;
  let budgetUnderCount = 0;
  let budgetApproachingCount = 0;
  const workQuantityByUnit = new Map<WorkUnit, number>();

  for (const task of projectTasks) {
    if (task.status === 'completed') doneCount += 1;
    if (task.status === 'blocked') blockedCount += 1;
    if (task.status === 'active') activeCount += 1;

    const trackedMs = durationByTask.get(task.id) ?? 0;
    const trackedPersonMs = personMsByTask.get(task.id) ?? 0;
    totalTimeMs += trackedMs;
    totalPersonMs += trackedPersonMs;

    const estimatedPersonMs = getEstimatedPersonMs(
      task.estimatedMinutes,
      task.defaultWorkers,
    );
    if (estimatedPersonMs !== null) {
      tasksWithEstimate += 1;
      estimatedPersonMsTotal += estimatedPersonMs;

      const budgetStatus = calculateBudgetStatusPersonHours(
        trackedPersonMs,
        estimatedPersonMs,
      );
      if (budgetStatus.status === 'over') budgetOverCount += 1;
      if (budgetStatus.status === 'under') budgetUnderCount += 1;
      if (budgetStatus.status === 'approaching') budgetApproachingCount += 1;
    }

    if (task.workQuantity !== null && task.workUnit !== null) {
      workQuantityByUnit.set(
        task.workUnit,
        (workQuantityByUnit.get(task.workUnit) ?? 0) + task.workQuantity,
      );
    }
  }

  const personHours = Math.round((totalPersonMs / 3600000) * 10) / 10;
  const estimatedPersonHours = tasksWithEstimate > 0
    ? Math.round((estimatedPersonMsTotal / 3600000) * 10) / 10
    : null;

  return {
    totalTasks,
    doneCount,
    blockedCount,
    activeCount,
    totalTimeMs,
    personHours,
    estimatedPersonHours,
    tasksWithEstimate,
    budgetOverCount,
    budgetUnderCount,
    budgetApproachingCount,
    workQuantityByUnit,
  };
}

import type { Project } from '../types';

export type ProjectTimelineFilter = 'all' | 'current' | 'next-90d' | 'past';
export type ProjectTimelineBucket = Exclude<ProjectTimelineFilter, 'all'> | 'unclassified';

export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const next = new Date(`${dateKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function getProjectTimelineFilter(
  project: Pick<Project, 'assemblyStartDate' | 'dismantleEndDate'>,
  todayDate: string,
): ProjectTimelineBucket {
  const assemblyStartDate = project.assemblyStartDate;
  const dismantleEndDate = project.dismantleEndDate;

  if (!assemblyStartDate || !dismantleEndDate) {
    return 'unclassified';
  }

  if (assemblyStartDate <= todayDate && todayDate <= dismantleEndDate) {
    return 'current';
  }

  const next90Cutoff = addDaysToDateKey(todayDate, 90);
  if (todayDate < assemblyStartDate && assemblyStartDate <= next90Cutoff) {
    return 'next-90d';
  }

  if (todayDate > dismantleEndDate) {
    return 'past';
  }

  return 'unclassified';
}

export function filterProjectsByTimeline<T extends Project>(
  projects: T[],
  filter: ProjectTimelineFilter,
  todayDate: string,
): T[] {
  if (filter === 'all') {
    return projects;
  }

  return projects.filter((project) => getProjectTimelineFilter(project, todayDate) === filter);
}

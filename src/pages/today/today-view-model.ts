import type { Project, Task } from '../../lib/types';

export interface TodayViewModel {
  groupedTasks: { project: Project; tasks: Task[] }[];
  ungroupedTasks: Task[];
  blockedTasks: Task[];
  completedTasks: Task[];
}

export function buildTodayViewModel(
  tasks: Task[],
  projects: Project[]
): TodayViewModel {
  const activeTasks = tasks.filter(
    (task) => task.status === 'active' && task.parentId === null
  );
  const blockedTasks = tasks.filter(
    (task) => task.status === 'blocked' && task.parentId === null
  );
  const completedTasks = tasks.filter(
    (task) => task.status === 'completed' && task.parentId === null
  );

  const byProject = new Map<string | null, Task[]>();
  for (const task of activeTasks) {
    const key = task.projectId;
    if (!byProject.has(key)) {
      byProject.set(key, []);
    }
    byProject.get(key)!.push(task);
  }

  const groupedTasks: TodayViewModel['groupedTasks'] = [];
  const ungroupedTasks = byProject.get(null) ?? [];

  for (const project of projects) {
    const projectTasks = byProject.get(project.id);
    if (projectTasks && projectTasks.length > 0) {
      groupedTasks.push({ project, tasks: projectTasks });
    }
  }

  return {
    groupedTasks,
    ungroupedTasks,
    blockedTasks,
    completedTasks,
  };
}

export function showPromotionalEmptyState(model: TodayViewModel): boolean {
  return (
    model.ungroupedTasks.length === 0 &&
    model.groupedTasks.length === 0 &&
    model.blockedTasks.length === 0 &&
    model.completedTasks.length === 0
  );
}

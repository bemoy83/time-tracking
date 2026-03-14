import { useCallback, useMemo } from 'react';
import { Project, Task, getProjectDisplayColor } from '../types';

/**
 * Resolve a task's project color from the current project list.
 */
export function useProjectColorResolver(projects: Project[]) {
  const colorByProjectId = useMemo(() => {
    const byId = new Map<string, string>();
    projects.forEach((project) => {
      byId.set(project.id, getProjectDisplayColor(project.color));
    });
    return byId;
  }, [projects]);

  return useCallback((task: Pick<Task, 'projectId'>) => {
    if (!task.projectId) return undefined;
    return colorByProjectId.get(task.projectId);
  }, [colorByProjectId]);
}

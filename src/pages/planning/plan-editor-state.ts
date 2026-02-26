import type { Project } from '../../lib/types';
import type { Plan } from '../../lib/planning/plan-model';

export function shouldResyncEditorState(
  previous: Pick<Plan, 'id' | 'updatedAt'>,
  next: Pick<Plan, 'id' | 'updatedAt'>,
): boolean {
  return previous.id !== next.id || previous.updatedAt !== next.updatedAt;
}

export function shouldClearPlanProjectId(
  projectId: string | null,
  projects: Pick<Project, 'id'>[],
): boolean {
  if (!projectId) return false;
  return !projects.some((project) => project.id === projectId);
}

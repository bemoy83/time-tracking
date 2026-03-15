import type { Plan } from '../../lib/planning/plan-model';
import type { Project, Task } from '../../lib/types';
import { PlanList } from './PlanList';

interface PlanningListRouteProps {
  plans: Plan[];
  projects: Project[];
  tasks: Task[];
  onSelect: (plan: Plan) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  onOpenInsights: () => void;
}

export function PlanningListRoute({
  plans,
  projects,
  tasks,
  onSelect,
  onCreate,
  onDelete,
  onOpenWrapUp,
  onOpenInsights,
}: PlanningListRouteProps) {
  return (
    <PlanList
      plans={plans}
      projects={projects}
      tasks={tasks}
      onSelect={onSelect}
      onCreate={onCreate}
      onDelete={onDelete}
      onOpenWrapUp={onOpenWrapUp}
      onOpenInsights={onOpenInsights}
    />
  );
}

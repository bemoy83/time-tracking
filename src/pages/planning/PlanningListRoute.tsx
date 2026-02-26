import type { Plan } from '../../lib/planning/plan-model';
import type { Task } from '../../lib/types';
import { PlanList } from './PlanList';

interface PlanningListRouteProps {
  plans: Plan[];
  tasks: Task[];
  onSelect: (plan: Plan) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenWrapUp: (plan: Plan) => void;
  onOpenInsights: () => void;
}

export function PlanningListRoute({
  plans,
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
      tasks={tasks}
      onSelect={onSelect}
      onCreate={onCreate}
      onDelete={onDelete}
      onOpenWrapUp={onOpenWrapUp}
      onOpenInsights={onOpenInsights}
    />
  );
}

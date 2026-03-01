import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { WrapUpSheet } from './WrapUpSheet';

interface PlanningWrapUpSheetProps {
  wrapUpPlan: Plan | null;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onClose: () => void;
  onCompleted: (updatedPlan: Plan, success: boolean) => void;
}

export function PlanningWrapUpSheet({
  wrapUpPlan,
  tasks,
  timeEntriesByTask,
  onClose,
  onCompleted,
}: PlanningWrapUpSheetProps) {
  if (!wrapUpPlan) return null;

  return (
    <WrapUpSheet
      isOpen
      plan={wrapUpPlan}
      tasks={tasks}
      timeEntriesByTask={timeEntriesByTask}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}

import type { Plan } from '../../lib/planning/plan-model';
import type { Task, WorkType } from '../../lib/types';
import { InsightsView } from './InsightsView';

interface PlanningInsightsRouteProps {
  tasks: Task[];
  workTypes: WorkType[];
  plans?: Plan[];
  onBack: () => void;
}

export function PlanningInsightsRoute({
  tasks,
  workTypes,
  plans = [],
  onBack,
}: PlanningInsightsRouteProps) {
  return (
    <div>
      <div className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
          Plans
        </button>
      </div>
      <InsightsView tasks={tasks} workTypes={workTypes} plans={plans} />
    </div>
  );
}

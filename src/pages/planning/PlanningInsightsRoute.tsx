import type { Plan } from '../../lib/planning/plan-model';
import type { Project, Task, WorkType } from '../../lib/types';
import { InsightsView } from './InsightsView';

interface PlanningInsightsRouteProps {
  tasks: Task[];
  workTypes: WorkType[];
  plans?: Plan[];
  projects?: Project[];
  onBack: () => void;
}

export function PlanningInsightsRoute({
  tasks,
  workTypes,
  plans = [],
  projects = [],
  onBack,
}: PlanningInsightsRouteProps) {
  return (
    <div>
      <div className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
          Plans
        </button>
      </div>
      <InsightsView tasks={tasks} workTypes={workTypes} plans={plans} projects={projects} />
    </div>
  );
}

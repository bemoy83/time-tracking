import { CountBadge } from '../../../components/CountBadge';
import {
  CheckIcon,
  ChevronRightIcon,
  ExpandChevronIcon,
  TaskListIcon,
} from '../../../components/icons';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import { useTaskStore } from '../../../lib/stores/task-store';

interface FieldPlanPlanSelectorProps {
  receivedPlans: Plan[];
  closedPlans: Plan[];
  selectedPlanId: string | null;
  showPastEvents: boolean;
  onTogglePastEvents: () => void;
  onSelectPlan: (planId: string) => void;
}

export function FieldPlanPlanSelector({
  receivedPlans,
  closedPlans,
  selectedPlanId,
  showPastEvents,
  onTogglePastEvents,
  onSelectPlan,
}: FieldPlanPlanSelectorProps) {
  const { projects } = useTaskStore();
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <section className="field-plan__plan-selector">
      <h2 className="field-plan__section-title section-heading">
        <TaskListIcon className="field-plan__icon" />
        Plans
        <CountBadge count={receivedPlans.length} variant="muted" />
      </h2>
      <div className="field-plan__plan-list">
        {receivedPlans.length === 0 && (
          <p className="field-plan__empty-text">No active received plans.</p>
        )}
        {receivedPlans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className={`field-plan__plan-btn${selectedPlanId === plan.id ? ' field-plan__plan-btn--active' : ''}`}
            onClick={() => onSelectPlan(plan.id)}
          >
            <span className="field-plan__plan-name">
              {getPlanDisplayName(plan, plan.projectId ? projectById.get(plan.projectId) ?? null : null)}
            </span>
            <ChevronRightIcon className="field-plan__plan-chevron" />
          </button>
        ))}
      </div>

      {closedPlans.length > 0 && (
        <div className="field-plan__past-section">
          <button
            type="button"
            className="field-plan__collapsible-toggle"
            onClick={onTogglePastEvents}
            aria-expanded={showPastEvents}
          >
            <CheckIcon className="field-plan__toggle-icon field-plan__toggle-icon--muted" />
            <span>Past Events</span>
            <CountBadge count={closedPlans.length} variant="muted" />
            <ExpandChevronIcon
              className={`field-plan__toggle-chevron${showPastEvents ? ' field-plan__toggle-chevron--expanded' : ''}`}
            />
          </button>
          {showPastEvents && (
            <div className="field-plan__plan-list">
              {closedPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`field-plan__plan-btn${selectedPlanId === plan.id ? ' field-plan__plan-btn--active' : ''}`}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  <span className="field-plan__plan-name">
                    {getPlanDisplayName(plan, plan.projectId ? projectById.get(plan.projectId) ?? null : null)}
                  </span>
                  <ChevronRightIcon className="field-plan__plan-chevron" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

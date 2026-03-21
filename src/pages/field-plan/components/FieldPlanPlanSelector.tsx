import { CountBadge } from '../../../components/CountBadge';
import {
  CheckIcon,
  ChevronRightIcon,
  ExpandChevronIcon,
  TaskListIcon,
  TrashIcon,
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
  onDeletePlan: (planId: string) => void;
}

export function FieldPlanPlanSelector({
  receivedPlans,
  closedPlans,
  selectedPlanId,
  showPastEvents,
  onTogglePastEvents,
  onSelectPlan,
  onDeletePlan,
}: FieldPlanPlanSelectorProps) {
  const { projects } = useTaskStore();
  const projectById = new Map(projects.map((project) => [project.id, project]));

  function renderPlanItem(plan: Plan) {
    const isActive = selectedPlanId === plan.id;
    return (
      <div key={plan.id} className="field-plan__plan-item">
        <button
          type="button"
          className={`field-plan__plan-btn${isActive ? ' field-plan__plan-btn--active' : ''}`}
          onClick={() => onSelectPlan(plan.id)}
        >
          <span className="field-plan__plan-name">
            {getPlanDisplayName(plan, plan.projectId ? projectById.get(plan.projectId) ?? null : null)}
          </span>
          <ChevronRightIcon className="field-plan__plan-chevron" />
        </button>
        <button
          type="button"
          className="field-plan__plan-delete"
          aria-label={`Delete plan ${getPlanDisplayName(plan, null)}`}
          onClick={(e) => {
            e.stopPropagation();
            void onDeletePlan(plan.id);
          }}
        >
          <TrashIcon className="field-plan__plan-delete-icon" />
        </button>
      </div>
    );
  }

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
        {receivedPlans.map(renderPlanItem)}
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
              {closedPlans.map(renderPlanItem)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

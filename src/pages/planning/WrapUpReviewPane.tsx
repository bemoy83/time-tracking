import { useRef } from 'react';
import type { Plan } from '../../lib/planning/plan-model';
import { getPlanDisplayName } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { useTaskStore } from '../../lib/stores/task-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { WrapUpReviewContent } from './WrapUpReviewContent';
import { useWrapUpSheetModelV2 } from './hooks/useWrapUpSheetModelV2';

interface WrapUpReviewPaneProps {
  plan: Plan;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onClose: () => void;
  onCompleted: (updatedPlan: Plan, success: boolean) => void | Promise<void>;
}

export function WrapUpReviewPane({
  plan,
  tasks,
  timeEntriesByTask,
  onClose,
  onCompleted,
}: WrapUpReviewPaneProps) {
  const { workTypes } = useWorkTypeStore();
  const { projects } = useTaskStore();
  const validationBlockRef = useRef<HTMLDivElement>(null);
  const selectedProject = plan.projectId
    ? projects.find((project) => project.id === plan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(plan, selectedProject);
  const model = useWrapUpSheetModelV2({
    isOpen: true,
    plan,
    tasks,
    timeEntriesByTask,
    onClose,
    onCompleted,
  });

  return (
    <div className="wrap-up-review-pane">
      <header className="wrap-up-review-pane__header">
        <div className="wrap-up-review-pane__header-text">
          <h2 className="wrap-up-review-pane__title">Wrap Up Review</h2>
          <span className="wrap-up-review-pane__plan-name">{planDisplayName}</span>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onClose}
          disabled={model.isSubmitting}
        >
          Cancel
        </button>
      </header>

      <WrapUpReviewContent
        model={model}
        workTypes={workTypes}
        onClose={onClose}
        validationBlockRef={validationBlockRef}
        layout="pane"
      />
    </div>
  );
}

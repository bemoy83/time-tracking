import { useRef } from 'react';
import { ActionSheet } from '../../components/ActionSheet';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { WrapUpReviewContent } from './WrapUpReviewContent';
import { useWrapUpSheetModelV2 } from './hooks/useWrapUpSheetModelV2';

interface WrapUpSheetProps {
  isOpen: boolean;
  plan: Plan;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onClose: () => void;
  onCompleted: (updatedPlan: Plan, success: boolean) => void | Promise<void>;
}

export function WrapUpSheet({
  isOpen,
  plan,
  tasks,
  timeEntriesByTask,
  onClose,
  onCompleted,
}: WrapUpSheetProps) {
  const { workTypes } = useWorkTypeStore();
  const validationBlockRef = useRef<HTMLDivElement>(null);
  const model = useWrapUpSheetModelV2({
    isOpen,
    plan,
    tasks,
    timeEntriesByTask,
    onClose,
    onCompleted,
  });

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title="Wrap Up Review">
      <WrapUpReviewContent
        model={model}
        workTypes={workTypes}
        onClose={onClose}
        validationBlockRef={validationBlockRef}
        layout="sheet"
      />
    </ActionSheet>
  );
}

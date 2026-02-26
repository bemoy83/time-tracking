import { useCallback, useEffect, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { shouldResyncEditorState } from '../plan-editor-state';

interface UsePlanEditorStateParams {
  plan: Plan;
  onSave: (plan: Plan) => void;
}

export function usePlanEditorState({ plan, onSave }: UsePlanEditorStateParams) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const lastSyncedRef = useRef<Pick<Plan, 'id' | 'updatedAt'>>({
    id: plan.id,
    updatedAt: plan.updatedAt,
  });

  useEffect(() => {
    if (!shouldResyncEditorState(lastSyncedRef.current, plan)) return;
    setCurrentPlan(plan);
    lastSyncedRef.current = { id: plan.id, updatedAt: plan.updatedAt };
  }, [plan]);

  const mutatePlan = useCallback(
    (updater: (prev: Plan) => Plan) => {
      setCurrentPlan((prev) => {
        const updated = updater(prev);
        if (updated === prev) {
          return prev;
        }
        onSave(updated);
        return updated;
      });
    },
    [onSave],
  );

  return {
    currentPlan,
    mutatePlan,
  };
}

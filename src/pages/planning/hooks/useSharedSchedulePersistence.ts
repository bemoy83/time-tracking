import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';

export interface UseSharedSchedulePersistenceParams {
  plansById: Map<string, Plan>;
  onSavePlan: (plan: Plan) => void | Promise<void>;
  autosaveDelay?: number;
}

export interface UseSharedSchedulePersistenceResult {
  effectivePlansById: Map<string, Plan>;
  applyPlanMutation: (planId: string, mutateFn: (plan: Plan) => Plan) => boolean;
}

/**
 * Shared schedule persistence — aligned with usePlanEditorState pattern.
 *
 * Single schedule: currentPlan in React state → setCurrentPlan on mutate → immediate re-render.
 * Shared schedule: optimisticOverrides in React state → setOptimisticOverrides on mutate → immediate re-render.
 *
 * Previously used an external controller + revision counter, which caused delayed/stale UI updates
 * because the data lived outside React and required an indirect setState(revision) to trigger re-reads.
 */
export function useSharedSchedulePersistence({
  plansById,
  onSavePlan,
  autosaveDelay = 500,
}: UseSharedSchedulePersistenceParams): UseSharedSchedulePersistenceResult {
  const onSavePlanRef = useRef(onSavePlan);
  onSavePlanRef.current = onSavePlan;

  // Optimistic overrides — React state, same pattern as usePlanEditorState's currentPlan.
  // UI reads from effectivePlansById (merge of plansById + optimisticOverrides) immediately.
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<string, Plan>>(() => new Map());

  // Save queue — refs for debouncing (like usePlanEditorState's pendingSaveRef + timerRef)
  const pendingSavesByIdRef = useRef<Map<string, Plan>>(new Map());
  const timersByPlanIdRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Effective plans = persisted + optimistic. Derived from state, updates synchronously with UI.
  const effectivePlansById = useMemo(() => {
    const merged = new Map(plansById);
    for (const [planId, plan] of optimisticOverrides) {
      merged.set(planId, plan);
    }
    return merged;
  }, [plansById, optimisticOverrides]);

  // Clear optimistic overrides when parent has synced (plan saved, plansById updated).
  useEffect(() => {
    setOptimisticOverrides((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [planId, optimisticPlan] of prev) {
        const persisted = plansById.get(planId);
        if (persisted && persisted.updatedAt === optimisticPlan.updatedAt) {
          next.delete(planId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [plansById]);

  const queueSave = useCallback(
    (plan: Plan) => {
      const existingTimer = timersByPlanIdRef.current.get(plan.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      pendingSavesByIdRef.current.set(plan.id, plan);

      const timer = setTimeout(() => {
        timersByPlanIdRef.current.delete(plan.id);
        const pending = pendingSavesByIdRef.current.get(plan.id);
        pendingSavesByIdRef.current.delete(plan.id);
        if (pending) {
          void onSavePlanRef.current(pending);
        }
      }, autosaveDelay);

      timersByPlanIdRef.current.set(plan.id, timer);
    },
    [autosaveDelay],
  );

  const applyPlanMutation = useCallback(
    (planId: string, mutateFn: (plan: Plan) => Plan): boolean => {
      const currentPlan = effectivePlansById.get(planId);
      if (!currentPlan) return false;

      const nextPlan = mutateFn(currentPlan);
      if (nextPlan === currentPlan || nextPlan.updatedAt === currentPlan.updatedAt) {
        return false;
      }

      // Immediate UI update — setState, same as single schedule's setCurrentPlan
      setOptimisticOverrides((prev) => {
        const next = new Map(prev);
        next.set(planId, nextPlan);
        return next;
      });

      // Queue save in background (like usePlanEditorState's debounced save)
      queueSave(nextPlan);
      return true;
    },
    [effectivePlansById, queueSave],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersByPlanIdRef.current.values()) {
        clearTimeout(timer);
      }
      timersByPlanIdRef.current.clear();
      const pending = Array.from(pendingSavesByIdRef.current.values());
      pendingSavesByIdRef.current.clear();
      for (const plan of pending) {
        void onSavePlanRef.current(plan);
      }
    };
  }, []);

  return {
    effectivePlansById,
    applyPlanMutation,
  };
}

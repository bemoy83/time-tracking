import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';

interface SharedSchedulePersistenceControllerParams {
  plansById: Map<string, Plan>;
  autosaveDelay: number;
  getOnSavePlan: () => (plan: Plan) => void | Promise<void>;
  onChange?: () => void;
}

export interface UseSharedSchedulePersistenceParams {
  plansById: Map<string, Plan>;
  onSavePlan: (plan: Plan) => void | Promise<void>;
  autosaveDelay?: number;
}

export interface UseSharedSchedulePersistenceResult {
  effectivePlansById: Map<string, Plan>;
  applyPlanMutation: (planId: string, mutateFn: (plan: Plan) => Plan) => boolean;
  flushAllPending: () => Promise<void>;
}

export interface SharedSchedulePersistenceController {
  setPersistedPlansById: (plansById: Map<string, Plan>) => void;
  getEffectivePlansById: () => Map<string, Plan>;
  applyPlanMutation: (planId: string, mutateFn: (plan: Plan) => Plan) => boolean;
  flushAllPending: () => Promise<void>;
  dispose: () => Promise<void>;
}

function removeSyncedOptimisticPlans(
  optimisticPlansById: Map<string, Plan>,
  pendingSavesById: Map<string, Plan>,
  timersByPlanId: Map<string, ReturnType<typeof setTimeout>>,
  persistedPlansById: Map<string, Plan>,
): boolean {
  let changed = false;

  for (const [planId, optimisticPlan] of optimisticPlansById) {
    const persistedPlan = persistedPlansById.get(planId);
    const isSynced = persistedPlan && persistedPlan.updatedAt === optimisticPlan.updatedAt;

    if (persistedPlan && !isSynced) {
      continue;
    }

    optimisticPlansById.delete(planId);
    pendingSavesById.delete(planId);

    const timer = timersByPlanId.get(planId);
    if (timer) {
      clearTimeout(timer);
      timersByPlanId.delete(planId);
    }

    changed = true;
  }

  return changed;
}

export function createSharedSchedulePersistenceController({
  plansById: initialPlansById,
  autosaveDelay,
  getOnSavePlan,
  onChange,
}: SharedSchedulePersistenceControllerParams): SharedSchedulePersistenceController {
  let persistedPlansById = initialPlansById;
  const optimisticPlansById = new Map<string, Plan>();
  const pendingSavesById = new Map<string, Plan>();
  const timersByPlanId = new Map<string, ReturnType<typeof setTimeout>>();

  const emitChange = () => {
    onChange?.();
  };

  const flushPlan = async (planId: string): Promise<void> => {
    const timer = timersByPlanId.get(planId);
    if (timer) {
      clearTimeout(timer);
      timersByPlanId.delete(planId);
    }

    const plan = pendingSavesById.get(planId);
    if (!plan) return;

    pendingSavesById.delete(planId);
    await getOnSavePlan()(plan);
  };

  const queuePlanSave = (plan: Plan): void => {
    optimisticPlansById.set(plan.id, plan);
    pendingSavesById.set(plan.id, plan);

    const existingTimer = timersByPlanId.get(plan.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      void flushPlan(plan.id);
    }, autosaveDelay);

    timersByPlanId.set(plan.id, timer);
    emitChange();
  };

  const getEffectivePlansById = (): Map<string, Plan> => {
    const merged = new Map(persistedPlansById);
    for (const [planId, optimisticPlan] of optimisticPlansById) {
      merged.set(planId, optimisticPlan);
    }
    return merged;
  };

  const flushAllPending = async (): Promise<void> => {
    const pendingPlanIds = Array.from(pendingSavesById.keys());
    for (const planId of pendingPlanIds) {
      await flushPlan(planId);
    }
    emitChange();
  };

  return {
    setPersistedPlansById(nextPlansById: Map<string, Plan>) {
      persistedPlansById = nextPlansById;
      const changed = removeSyncedOptimisticPlans(
        optimisticPlansById,
        pendingSavesById,
        timersByPlanId,
        persistedPlansById,
      );
      if (changed) emitChange();
    },

    getEffectivePlansById,

    applyPlanMutation(planId: string, mutateFn: (plan: Plan) => Plan): boolean {
      const currentPlan = getEffectivePlansById().get(planId);
      if (!currentPlan) return false;

      const nextPlan = mutateFn(currentPlan);
      if (nextPlan === currentPlan || nextPlan.updatedAt === currentPlan.updatedAt) {
        return false;
      }

      queuePlanSave(nextPlan);
      return true;
    },

    flushAllPending,

    async dispose(): Promise<void> {
      await flushAllPending();
      for (const timer of timersByPlanId.values()) {
        clearTimeout(timer);
      }
      timersByPlanId.clear();
    },
  };
}

export function useSharedSchedulePersistence({
  plansById,
  onSavePlan,
  autosaveDelay = 500,
}: UseSharedSchedulePersistenceParams): UseSharedSchedulePersistenceResult {
  const onSavePlanRef = useRef(onSavePlan);
  const isMountedRef = useRef(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    onSavePlanRef.current = onSavePlan;
  }, [onSavePlan]);

  const controllerRef = useRef<SharedSchedulePersistenceController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createSharedSchedulePersistenceController({
      plansById,
      autosaveDelay,
      getOnSavePlan: () => onSavePlanRef.current,
      onChange: () => {
        if (isMountedRef.current) {
          setRevision((prev) => prev + 1);
        }
      },
    });
  }

  const controller = controllerRef.current;

  useEffect(() => {
    controller.setPersistedPlansById(plansById);
  }, [controller, plansById]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      void controller.dispose();
    };
  }, [controller]);

  const applyPlanMutation = useCallback((planId: string, mutateFn: (plan: Plan) => Plan) => (
    controller.applyPlanMutation(planId, mutateFn)
  ), [controller]);

  const flushAllPending = useCallback(() => controller.flushAllPending(), [controller]);

  const effectivePlansById = useMemo(
    () => controller.getEffectivePlansById(),
    [controller, revision],
  );

  return {
    effectivePlansById,
    applyPlanMutation,
    flushAllPending,
  };
}

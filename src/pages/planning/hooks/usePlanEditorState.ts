import { useCallback, useEffect, useRef, useState } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { shouldResyncEditorState } from '../plan-editor-state';

/** Debounce delay for autosave (ms). */
const AUTOSAVE_DELAY = 500;

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
  const pendingSaveRef = useRef<Plan | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Flush any pending debounced save immediately
  const flush = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingSaveRef.current) {
      onSaveRef.current(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  }, []);

  /** Flush pending save and wait for it to complete. Use before navigating away. */
  const flushAndWait = useCallback(async () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) {
      await onSaveRef.current(pending);
    }
  }, []);

  useEffect(() => {
    if (!shouldResyncEditorState(lastSyncedRef.current, plan)) return;
    setCurrentPlan(plan);
    lastSyncedRef.current = { id: plan.id, updatedAt: plan.updatedAt };
  }, [plan]);

  // Flush pending save on plan switch or unmount
  useEffect(() => {
    return () => flush();
  }, [plan.id, flush]);

  const mutatePlan = useCallback(
    (updater: (prev: Plan) => Plan) => {
      setCurrentPlan((prev) => {
        const updated = updater(prev);
        if (updated === prev) {
          return prev;
        }

        // Lifecycle transitions (status change) save immediately
        if (updated.status !== prev.status) {
          // Clear any pending debounced save — the lifecycle save supersedes it
          if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          pendingSaveRef.current = null;
          onSaveRef.current(updated);
          return updated;
        }

        // Content edits: debounce the save
        pendingSaveRef.current = updated;
        if (timerRef.current != null) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (pendingSaveRef.current) {
            onSaveRef.current(pendingSaveRef.current);
            pendingSaveRef.current = null;
          }
        }, AUTOSAVE_DELAY);

        return updated;
      });
    },
    [],
  );

  return {
    currentPlan,
    mutatePlan,
    /** Flush any pending debounced save immediately. */
    flush,
    /** Flush and wait for save to complete. Use before navigating away. */
    flushAndWait,
  };
}

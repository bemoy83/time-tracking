import { useEffect, useState } from 'react';
import { getLatestExecutionReturnBundleByPlanId } from '../../../lib/db';
import type { ImportedExecutionStatusByLineItem, ImportedLineItemExecutionState } from '../../../lib/planning/plan-progress';
import type { BuildPhase } from '../../../lib/types';
import { subscribeToExecutionReturnImported } from '../../../lib/planning/execution-return-import-events';

const VALID_STATUSES = ['completed', 'in-progress', 'pending', 'blocked', 'deferred'] as const;

export function useExecutionReturnForProgress(planId: string | null): ImportedExecutionStatusByLineItem | null {
  const [importedStatus, setImportedStatus] = useState<ImportedExecutionStatusByLineItem | null>(null);

  useEffect(() => {
    if (!planId) {
      setImportedStatus(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      getLatestExecutionReturnBundleByPlanId(planId).then((bundle) => {
        if (cancelled) return;
        if (!bundle?.lineItems?.length) {
          setImportedStatus(null);
          return;
        }
        const map = new Map<string, ImportedLineItemExecutionState>();
        const fallbackByLineItem = new Map<string, ImportedLineItemExecutionState>();
        for (const li of bundle.lineItems) {
          if (VALID_STATUSES.includes(li.executionStatus as (typeof VALID_STATUSES)[number])) {
            const phase: BuildPhase = li.phase === 'dismantle' ? 'dismantle' : 'assembly';
            const state: ImportedLineItemExecutionState = {
              status: li.executionStatus as ImportedLineItemExecutionState['status'],
              blockReason: li.blockReason ?? null,
              blockCategory: li.blockCategory ?? null,
              deferredNote: li.deferredNote ?? null,
              phase,
            };
            map.set(`${li.lineItemId}:${phase}`, state);
            if (!fallbackByLineItem.has(li.lineItemId)) {
              fallbackByLineItem.set(li.lineItemId, state);
            }
          }
        }
        setImportedStatus(
          map.size > 0
            ? {
                get: (id, phase) => {
                  if (phase) {
                    return map.get(`${id}:${phase}`) ?? fallbackByLineItem.get(id);
                  }
                  return fallbackByLineItem.get(id);
                },
              }
            : null,
        );
      });
    };

    load();
    const unsubscribe = subscribeToExecutionReturnImported(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [planId]);

  return importedStatus;
}

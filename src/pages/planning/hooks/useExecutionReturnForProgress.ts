import { useEffect, useState } from 'react';
import { getLatestExecutionReturnBundleByPlanId } from '../../../lib/db';
import type { ImportedExecutionStatusByLineItem, ImportedLineItemExecutionState } from '../../../lib/planning/plan-progress';

const VALID_STATUSES = ['completed', 'in-progress', 'pending', 'blocked', 'deferred'] as const;

export function useExecutionReturnForProgress(planId: string | null): ImportedExecutionStatusByLineItem | null {
  const [importedStatus, setImportedStatus] = useState<ImportedExecutionStatusByLineItem | null>(null);

  useEffect(() => {
    if (!planId) {
      setImportedStatus(null);
      return;
    }
    let cancelled = false;
    getLatestExecutionReturnBundleByPlanId(planId).then((bundle) => {
      if (cancelled) return;
      if (!bundle?.lineItems?.length) {
        setImportedStatus(null);
        return;
      }
      const map = new Map<string, ImportedLineItemExecutionState>();
      for (const li of bundle.lineItems) {
        if (VALID_STATUSES.includes(li.executionStatus as (typeof VALID_STATUSES)[number])) {
          map.set(li.lineItemId, {
            status: li.executionStatus as ImportedLineItemExecutionState['status'],
            blockReason: li.blockReason ?? null,
            blockCategory: li.blockCategory ?? null,
            deferredNote: li.deferredNote ?? null,
          });
        }
      }
      setImportedStatus(map.size > 0 ? { get: (id) => map.get(id) } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return importedStatus;
}

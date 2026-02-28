import { useEffect, useState } from 'react';
import { getLatestExecutionReturnBundleByPlanId } from '../../../lib/db';
import type { ImportedExecutionStatusByLineItem } from '../../../lib/planning/plan-progress';

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
      const map = new Map<string, 'completed' | 'in-progress' | 'pending' | 'blocked' | 'deferred'>();
      for (const li of bundle.lineItems) {
        if (
          li.executionStatus === 'completed' ||
          li.executionStatus === 'in-progress' ||
          li.executionStatus === 'pending' ||
          li.executionStatus === 'blocked' ||
          li.executionStatus === 'deferred'
        ) {
          map.set(li.lineItemId, li.executionStatus);
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

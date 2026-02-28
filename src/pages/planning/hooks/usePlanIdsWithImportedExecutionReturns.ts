import { useEffect, useState } from 'react';
import { getPlanIdsWithImportedExecutionReturns } from '../../../lib/db';
import { subscribeToExecutionReturnImported } from '../../../lib/planning/execution-return-import-events';

/** Returns the set of plan IDs that have imported execution returns. Re-fetches when an import occurs. */
export function usePlanIdsWithImportedExecutionReturns(): Set<string> {
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      getPlanIdsWithImportedExecutionReturns().then((ids) => {
        if (!cancelled) {
          setPlanIds(new Set(ids));
        }
      });
    };

    load();
    const unsubscribe = subscribeToExecutionReturnImported(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return planIds;
}

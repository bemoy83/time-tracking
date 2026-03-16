import { useRef, useState, type ChangeEvent } from 'react';
import type { Plan, PlanLineItem } from '../../../lib/planning/plan-model';
import { addLineItemsToPlan } from '../../../lib/planning/plan-model';
import {
  parsePlanLineItemCsv,
  importedPlanLineItemsToLineItems,
  type ImportedPlanLineItem,
} from '../../../lib/interop/plan-line-item-import';
import { ensureWorkTypeExistsOrCreate } from '../../../lib/stores/work-type-store';

interface UsePlanLineItemImportOptions {
  mutatePlan: (updater: (prev: Plan) => Plan) => void;
}

interface UsePlanLineItemImportResult {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleConfirm: () => void;
  handleCancel: () => void;
  /** Number of items staged for import. null when nothing is pending. */
  pendingCount: number | null;
  isApplying: boolean;
}

export function usePlanLineItemImport({
  mutatePlan,
}: UsePlanLineItemImportOptions): UsePlanLineItemImportResult {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingItems, setPendingItems] = useState<PlanLineItem[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after cancel.
    if (fileInputRef.current) fileInputRef.current.value = '';

    const text = await file.text();
    const result = parsePlanLineItemCsv(text);

    if (!result.valid || result.items.length === 0) {
      if (result.errors.length > 0) {
        console.error('[usePlanLineItemImport] CSV parse errors:', result.errors);
      }
      return;
    }

    // Resolve any unknown work types by creating them.
    const resolved: ImportedPlanLineItem[] = await Promise.all(
      result.items.map(async (item) => {
        if (item.workTypeId !== null) return item;
        const workTypeId = await ensureWorkTypeExistsOrCreate(
          item.workTypeTitle,
          item.workUnit,
          item.assemblyRate,
          item.dismantleRate,
        );
        return { ...item, workTypeId };
      }),
    );

    setPendingItems(importedPlanLineItemsToLineItems(resolved));
  };

  const handleConfirm = () => {
    if (!pendingItems || pendingItems.length === 0) return;
    setIsApplying(true);
    mutatePlan((prev) => addLineItemsToPlan(prev, pendingItems));
    setPendingItems(null);
    setIsApplying(false);
  };

  const handleCancel = () => {
    setPendingItems(null);
  };

  return {
    fileInputRef,
    handleFileChange,
    handleConfirm,
    handleCancel,
    pendingCount: pendingItems !== null ? pendingItems.length : null,
    isApplying,
  };
}

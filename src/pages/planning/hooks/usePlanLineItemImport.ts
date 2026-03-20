import { useRef, useState, type ChangeEvent } from 'react';
import type { Plan, PlanLineItem } from '../../../lib/planning/plan-model';
import { addLineItemsToPlan } from '../../../lib/planning/plan-model';
import {
  parsePlanLineItemCsv,
  importedPlanLineItemsToLineItems,
  type ImportedPlanLineItem,
} from '../../../lib/interop/plan-line-item-import';
import type { WorkUnitImportPreview } from '../../../lib/interop/work-unit-import-preview';
import { useWorkUnitStore } from '../../../lib/stores/work-unit-store';
import { ensureWorkTypeExistsOrCreate } from '../../../lib/stores/work-type-store';
import { useWorkUnitImportPreview } from '../../../lib/hooks/useWorkUnitImportPreview';
import { provisionWorkUnitsForImport } from '../../../lib/interop/work-unit-import';

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
  pendingWorkUnitPreview: WorkUnitImportPreview | null;
  applyImportedUnitLabels: boolean;
  setApplyImportedUnitLabels: (value: boolean) => void;
  isApplying: boolean;
}

export function usePlanLineItemImport({
  mutatePlan,
}: UsePlanLineItemImportOptions): UsePlanLineItemImportResult {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { definitions } = useWorkUnitStore();
  const [pendingImportedItems, setPendingImportedItems] = useState<ImportedPlanLineItem[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const {
    preview: pendingWorkUnitPreview,
    applyImportedLabels: applyImportedUnitLabels,
    setApplyImportedLabels: setApplyImportedUnitLabels,
  } = useWorkUnitImportPreview(
    pendingImportedItems?.map((item) => ({
      id: item.workUnit,
      label: item.workUnitLabel,
    })) ?? null,
    definitions,
  );

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
    setPendingImportedItems(result.items);
  };

  const handleConfirm = async () => {
    if (!pendingImportedItems || pendingImportedItems.length === 0) return;
    setIsApplying(true);
    try {
      await provisionWorkUnitsForImport(
        pendingImportedItems,
        (item) => ({
          workUnit: item.workUnit,
          workUnitLabel: item.workUnitLabel ?? null,
        }),
        { applyLabelToExisting: applyImportedUnitLabels },
      );

      const resolved: ImportedPlanLineItem[] = await Promise.all(
        pendingImportedItems.map(async (item) => {
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

      const nextItems: PlanLineItem[] = importedPlanLineItemsToLineItems(resolved);
      mutatePlan((prev) => addLineItemsToPlan(prev, nextItems));
      setPendingImportedItems(null);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    setPendingImportedItems(null);
  };

  return {
    fileInputRef,
    handleFileChange,
    handleConfirm,
    handleCancel,
    pendingCount: pendingImportedItems !== null ? pendingImportedItems.length : null,
    pendingWorkUnitPreview,
    applyImportedUnitLabels,
    setApplyImportedUnitLabels,
    isApplying,
  };
}

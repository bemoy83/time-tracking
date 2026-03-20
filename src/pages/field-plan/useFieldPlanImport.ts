import { useCallback, useState, type ChangeEvent } from 'react';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import type { PlanPackageImportPreview } from '../../lib/interop/data-transfer/contracts';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';

interface UseFieldPlanImportParams {
  onMessage: (message: string | null) => void;
  onImportApplied: (planId: string) => Promise<void>;
}

export function useFieldPlanImport({
  onMessage,
  onImportApplied,
}: UseFieldPlanImportParams) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PlanPackageImportPreview | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const { definitions } = useWorkUnitStore();
  const {
    preview: workUnitPreview,
    applyImportedLabels: applyImportedUnitLabels,
    setApplyImportedLabels: setApplyImportedUnitLabels,
  } = useWorkUnitImportPreview(
    preview?.envelope.payload.workUnitDefinitions?.map((definition) => ({
      id: definition.id,
      label: definition.label,
    })) ?? null,
    definitions,
  );

  const resetImportPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    onMessage(null);
    setPreview(null);
    setIsLoadingPreview(true);

    try {
      const text = await file.text();
      const parsed = parsePlanPackageJson(text);
      if (!parsed.ok) {
        onMessage(parsed.error);
        return;
      }

      const nextPreview = await previewPlanPackageImport(parsed.envelope);
      setPreview(nextPreview);
      trackTelemetryEvent('interop_plan_package_preview');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [onMessage]);

  const handleApplyImport = useCallback(async (resolution: 'replace' | 'skip' = 'replace') => {
    if (!preview) return;
    setIsApplyingImport(true);

    try {
      const result = await applyPlanPackageImport(preview, resolution, {
        applyLabelToExistingWorkUnits: applyImportedUnitLabels,
      });
      let message = result.reason;
      if (result.mergeSummary) {
        const { newCount, updatedCount, unchangedCount, removedCount } = result.mergeSummary;
        message += ` Merged: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${removedCount} removed.`;
      }
      onMessage(message);
      if (result.applied) {
        setPreview(null);
        await onImportApplied(preview.planId);
        trackTelemetryEvent(result.merged ? 'interop_plan_package_merge' : 'interop_plan_package_import');
      } else if (resolution === 'skip') {
        trackTelemetryEvent('interop_plan_package_skip');
      } else {
        trackTelemetryEvent('interop_plan_package_conflict');
      }
    } finally {
      setIsApplyingImport(false);
    }
  }, [onImportApplied, onMessage, preview]);

  return {
    isLoadingPreview,
    preview,
    workUnitPreview,
    applyImportedUnitLabels,
    setApplyImportedUnitLabels,
    isApplyingImport,
    handleFileChange,
    handleApplyImport,
    resetImportPreview,
  };
}

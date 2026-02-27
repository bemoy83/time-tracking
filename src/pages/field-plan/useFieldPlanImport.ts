import { useCallback, useState, type ChangeEvent } from 'react';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import type { PlanPackageImportPreview } from '../../lib/interop/data-transfer/contracts';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

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
      const result = await applyPlanPackageImport(preview, resolution);
      onMessage(result.reason);
      if (result.applied) {
        setPreview(null);
        await onImportApplied(preview.planId);
        trackTelemetryEvent(result.merged ? 'interop_plan_package_merge' : 'interop_plan_package_import');
        if (preview.envelope.schemaVersion === '1.0') {
          trackTelemetryEvent('schedule_import_defaulted');
        }
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
    isApplyingImport,
    handleFileChange,
    handleApplyImport,
    resetImportPreview,
  };
}

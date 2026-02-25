import { useState } from 'react';
import { getFeatureFlag } from '../../../../lib/flags/feature-flags';
import { isRolloutGateOpen, IMPORT_APPLY_GATE } from '../../../../lib/flags/rollout-gates';
import { parseWorkPackageCsv } from '../../../../lib/interop/import';
import { generateImportPreview, type ImportPreview } from '../../../../lib/interop/import-preview';
import { applyWorkPackageImportItems } from '../../../../lib/interop/work-package-import-apply';
import { trackTelemetryEvent } from '../../../../lib/telemetry/telemetry';
import type { Task, TaskTemplate } from '../../../../lib/types';

interface UseInteropWorkPackageImportOptions {
  tasks: Task[];
  templates: TaskTemplate[];
  workTypeTitleById: Map<string, string>;
}

function previewItemSignature(item: ImportPreview['items'][number]): string {
  return [
    item.action,
    item.existingId ?? '',
    item.existingType ?? '',
    item.changedFields.join('|'),
  ].join('::');
}

export function useInteropWorkPackageImport({
  tasks,
  templates,
  workTypeTitleById,
}: UseInteropWorkPackageImportOptions) {
  const [csvInput, setCsvInput] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applySummary, setApplySummary] = useState<string | null>(null);

  const staleGuardEnabled = getFeatureFlag('interopStaleImportGuard');
  const importApplyGateOpen = isRolloutGateOpen(IMPORT_APPLY_GATE);

  const handleParse = () => {
    const parsed = parseWorkPackageCsv(csvInput);
    if (!parsed.valid) {
      setPreview(null);
      setParseErrors(parsed.errors.map((error) => `Row ${error.row}: ${error.field} - ${error.message}`));
      return;
    }

    const nextPreview = generateImportPreview(parsed.items, tasks, templates, workTypeTitleById);
    setParseErrors([]);
    setPreview(nextPreview);
  };

  const handleApply = async () => {
    if (!preview || preview.duplicateKeys.length > 0) return;

    setIsApplying(true);
    let conflicts = 0;

    try {
      const revalidated = generateImportPreview(
        preview.items.map((item) => item.item),
        tasks,
        templates,
        workTypeTitleById,
      );

      const staleItems = preview.items.filter((item, index) => {
        const latest = revalidated.items[index];
        if (!latest) return true;
        return previewItemSignature(item) !== previewItemSignature(latest);
      });

      if (revalidated.duplicateKeys.length > 0 || (staleGuardEnabled && staleItems.length > 0)) {
        setPreview(revalidated);
        conflicts = (staleGuardEnabled ? staleItems.length : 0) + revalidated.duplicateKeys.length;
        setApplySummary(
          `Import conflicts detected: ${staleGuardEnabled ? staleItems.length : 0} stale item(s), ${revalidated.duplicateKeys.length} duplicate key issue(s). Re-review preview before apply.`,
        );
        trackTelemetryEvent('interop_import_conflict');
        return;
      }

      const { created, updated, skipped } = await applyWorkPackageImportItems(revalidated.items);
      setApplySummary(`Applied import: ${created} created, ${updated} updated, ${skipped} skipped, ${conflicts} conflicts.`);
      trackTelemetryEvent('interop_import_apply');
      setPreview(null);
      setCsvInput('');
      setParseErrors([]);
    } finally {
      setIsApplying(false);
    }
  };

  return {
    csvInput,
    setCsvInput,
    parseErrors,
    preview,
    isApplying,
    applySummary,
    setApplySummary,
    importApplyGateOpen,
    handleParse,
    handleApply,
  };
}

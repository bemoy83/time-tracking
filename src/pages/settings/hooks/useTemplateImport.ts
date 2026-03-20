import { useCallback, useState, type ChangeEvent } from 'react';
import { generateImportPreview, type ImportPreview } from '../../../lib/interop/import-preview';
import { parseWorkPackageCsv } from '../../../lib/interop/import';
import { applyWorkPackageImportItems } from '../../../lib/interop/work-package-import-apply';
import { ensureImportedWorkUnits } from '../../../lib/stores/work-unit-store';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';
import type { Task, TaskTemplate } from '../../../lib/types';

interface UseTemplateImportOptions {
  tasks: Task[];
  templates: TaskTemplate[];
  workTypeTitleById: Map<string, string>;
}

export function useTemplateImport({
  tasks,
  templates,
  workTypeTitleById,
}: UseTemplateImportOptions) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applySummary, setApplySummary] = useState<string | null>(null);

  const importApplyGateOpen = true;

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = '';
      setApplySummary(null);
      setPreview(null);
      setIsLoadingPreview(true);

      try {
        const text = await file.text();
        const parsed = parseWorkPackageCsv(text);
        if (!parsed.valid) {
          setApplySummary(
            parsed.errors.map((e) => `Row ${e.row}: ${e.field} - ${e.message}`).join('; '),
          );
          return;
        }
        const nextPreview = generateImportPreview(
          parsed.items,
          tasks,
          templates,
          workTypeTitleById,
        );
        setPreview(nextPreview);
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [tasks, templates, workTypeTitleById],
  );

  const handleApply = useCallback(async (applyImportedUnitLabels: boolean = false) => {
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

      if (revalidated.duplicateKeys.length > 0) {
        setPreview(revalidated);
        conflicts = revalidated.duplicateKeys.length;
        setApplySummary(
          `Import conflicts detected: ${revalidated.duplicateKeys.length} duplicate key issue(s). Re-review preview before apply.`,
        );
        trackTelemetryEvent('interop_import_conflict');
        return;
      }

      const { created, updated, skipped, unitsCreated, unitLabelsUpdated } = await applyWorkPackageImportItems(
        revalidated.items,
        {
          ensureImportedWorkUnitsFn: (items, options) =>
            ensureImportedWorkUnits(items, {
              ...options,
              applyLabelToExisting: applyImportedUnitLabels,
            }),
        },
      );
      setApplySummary(
        `Applied import: ${created} created, ${updated} updated, ${skipped} skipped, ${unitsCreated} unit${unitsCreated === 1 ? '' : 's'} added, ${unitLabelsUpdated} unit label${unitLabelsUpdated === 1 ? '' : 's'} updated, ${conflicts} conflicts.`,
      );
      trackTelemetryEvent('interop_import_apply');
      setPreview(null);
    } finally {
      setIsApplying(false);
    }
  }, [preview, tasks, templates, workTypeTitleById]);

  return {
    preview,
    isLoadingPreview,
    isApplying,
    applySummary,
    importApplyGateOpen,
    handleFileChange,
    handleApply,
  };
}
